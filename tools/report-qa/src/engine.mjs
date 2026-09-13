/**
 * The rule engine.
 *
 * Loads a Document, resolves the dialect, runs every enabled rule, then
 * normalises, suppresses, de-duplicates and sorts the findings. A rule that
 * throws is reported as a tool error rather than taking the whole run down -
 * a QA pass that dies on one odd paragraph is worse than one that reports 90%.
 */

import { severityRank } from './config.mjs';
import { rules as confidentialityRules } from './rules/confidentiality.mjs';
import { rules as cyberRules } from './rules/cyber.mjs';
import { collectDialectEvidence, detectDialect, rules as dialectRules } from './rules/dialect.mjs';
import { rules as languageRules } from './rules/language.mjs';
import { rules as numberRules } from './rules/numbers.mjs';
import { rules as punctuationRules } from './rules/punctuation.mjs';
import { rules as structureRules } from './rules/structure.mjs';
import { rules as terminologyRules } from './rules/terminology.mjs';
import { rules as whitespaceRules } from './rules/whitespace.mjs';
import { countWords, excerptAround } from './text.mjs';

export const ALL_RULES = [
  ...confidentialityRules,
  ...structureRules,
  ...cyberRules,
  ...numberRules,
  ...dialectRules,
  ...terminologyRules,
  ...punctuationRules,
  ...whitespaceRules,
  ...languageRules,
];

/** Inline suppression: `<!-- qa-disable rule/id -->` disables for the next line. */
const SUPPRESSION = /(?:<!--|\/\/|#)\s*qa-disable(?:-next-line)?\s+([^\s>,]+(?:\s*,\s*[^\s>,]+)*)\s*(?:-->)?/g;

export function analyse(doc, { config, now = new Date() } = {}) {
  const dialectEvidence = collectDialectEvidence(doc);
  const detection = detectDialect(doc);
  const dialect = config.dialect === 'auto' ? detection.dialect : config.dialect;

  const ctx = { config, dialect, dialectEvidence, now, detection };
  const suppressions = collectSuppressions(doc);

  const findings = [];
  const errors = [];

  for (const rule of ALL_RULES) {
    const setting = config.rules?.[rule.id];
    if (setting === 'off') continue;

    let produced;
    try {
      produced = rule.check(doc, ctx) || [];
    } catch (error) {
      errors.push({ rule: rule.id, message: error.message, stack: error.stack });
      continue;
    }

    for (const raw of produced) {
      const severity = setting && setting !== 'off' ? setting : (raw.severity || rule.severity);
      const position = doc.position(raw.start);
      if (isSuppressed(suppressions, position.line, rule.id)) continue;

      findings.push({
        rule: rule.id,
        title: rule.title,
        category: rule.category,
        severity,
        confidence: raw.confidence || 'high',
        message: raw.message,
        suggestion: raw.suggestion,
        note: raw.note,
        line: position.line,
        column: position.column,
        start: raw.start,
        end: raw.end,
        occurrences: raw.occurrences,
        aggregate: Boolean(raw.aggregate),
        documentLevel: Boolean(raw.documentLevel),
        fix: raw.fix,
        fixable: Boolean(rule.fixable && raw.fix !== undefined),
        redact: Boolean(raw.redact),
      });
    }
  }

  // Excerpts are built only once every rule has run, against a copy of the text
  // with EVERY sensitive span masked. Doing it per finding would mask a
  // credential in its own excerpt but still reprint it in the context window of
  // a neighbouring finding a line away - which is how a secret escapes a QA
  // report that believed it was redacting.
  const maskedText = maskSensitiveSpans(doc.text, findings);
  for (const finding of findings) {
    finding.excerpt = finding.documentLevel ? null : excerptAround(maskedText, finding.start, finding.end);
  }

  const deduped = dedupe(findings);
  deduped.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)
    || a.line - b.line
    || a.column - b.column
    || a.rule.localeCompare(b.rule));

  return {
    findings: deduped,
    errors,
    stats: buildStats(doc, deduped, detection, dialect),
  };
}

/**
 * Collapse duplicates. Identical findings are dropped outright, and a rule that
 * fires twice on overlapping spans (a placeholder matching both a bracket
 * pattern and the word inside it) reports once, keeping the widest span.
 */
function dedupe(findings) {
  const seen = new Set();
  const unique = [];
  for (const finding of findings) {
    const key = `${finding.rule}:${finding.start}:${finding.end}:${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }

  const keptByRule = new Map();
  const out = [];
  // Most severe first, then widest, so a blocker never loses to a nit that
  // happens to cover the same span.
  const byWidth = [...unique].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)
    || (b.end - b.start) - (a.end - a.start));
  const dropped = new Set();
  for (const finding of byWidth) {
    const kept = keptByRule.get(finding.rule) || [];
    if (kept.some((other) => finding.start < other.end && other.start < finding.end)) {
      dropped.add(finding);
      continue;
    }
    kept.push(finding);
    keptByRule.set(finding.rule, kept);
  }
  for (const finding of unique) {
    if (!dropped.has(finding)) out.push(finding);
  }
  return out;
}

function collectSuppressions(doc) {
  const map = new Map();
  let match;
  SUPPRESSION.lastIndex = 0;
  while ((match = SUPPRESSION.exec(doc.text)) !== null) {
    const { line } = doc.position(match.index);
    const ids = match[1].split(',').map((id) => id.trim()).filter(Boolean);
    for (const offset of [line, line + 1]) {
      if (!map.has(offset)) map.set(offset, new Set());
      for (const id of ids) map.get(offset).add(id);
    }
  }
  return map;
}

function isSuppressed(suppressions, line, ruleId) {
  const ids = suppressions.get(line);
  if (!ids) return false;
  if (ids.has('all') || ids.has(ruleId)) return true;
  // A category prefix suppresses every rule beneath it: `qa-disable language`
  const prefix = ruleId.split('/')[0];
  return ids.has(prefix);
}

/**
 * Return a copy of the text with every span a rule marked sensitive replaced by
 * asterisks. The replacement is the same length as the original, so all finding
 * offsets stay valid and excerpts can be cut from this copy directly.
 */
function maskSensitiveSpans(text, findings) {
  const spans = findings.filter((f) => f.redact && f.end > f.start);
  if (!spans.length) return text;

  const chars = [...text];
  for (const span of spans) {
    for (let i = Math.max(0, span.start); i < Math.min(chars.length, span.end); i += 1) {
      if (!/\s/.test(chars[i])) chars[i] = '*';
    }
  }
  return chars.join('');
}

function buildStats(doc, findings, detection, dialect) {
  const words = countWords(doc.blocks
    .filter((b) => b.type !== 'code')
    .map((b) => b.text)
    .join(' '));

  const bySeverity = { blocker: 0, major: 0, minor: 0, nit: 0 };
  const byCategory = {};
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
  }

  return {
    words,
    paragraphs: doc.blocks.filter((b) => b.type === 'paragraph').length,
    headings: doc.headings().length,
    listItems: doc.blocks.filter((b) => b.type === 'listItem').length,
    tableRows: doc.blocks.filter((b) => b.type === 'tableRow').length,
    sentences: doc.sentences().length,
    dialect,
    dialectEvidence: { british: detection.gb, american: detection.us },
    total: findings.length,
    bySeverity,
    byCategory,
    fixable: findings.filter((f) => f.fixable).length,
  };
}
