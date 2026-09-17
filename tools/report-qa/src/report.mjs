/**
 * Output formatting.
 *
 * Three shapes, for three readers:
 *   text  - a terminal run while editing
 *   md    - a QA report to paste into a review thread or hand to an author
 *   json  - for the agent layer, which re-reads findings and judges them
 */

import { SEVERITIES } from './config.mjs';

const LABEL = {
  blocker: 'BLOCKER',
  major: 'MAJOR',
  minor: 'MINOR',
  nit: 'NIT',
};

const COLOUR = {
  blocker: '[41;97m',
  major: '[31;1m',
  minor: '[33m',
  nit: '[90m',
};
const RESET = '[0m';
const DIM = '[2m';
const BOLD = '[1m';

export function formatJson(result, meta) {
  return JSON.stringify({
    source: meta.source,
    format: meta.format,
    checkedAt: meta.now.toISOString(),
    config: meta.configPath,
    stats: result.stats,
    findings: result.findings.map((f) => ({
      rule: f.rule,
      title: f.title,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      line: f.line,
      column: f.column,
      slide: f.slide,
      region: f.region,
      message: f.message,
      suggestion: f.suggestion,
      note: f.note,
      excerpt: f.excerpt,
      occurrences: f.occurrences,
      aggregate: f.aggregate,
      fixable: f.fixable,
    })),
    ruleErrors: result.errors,
  }, null, 2);
}

export function formatText(result, meta, { colour = true, quiet = false } = {}) {
  const c = (code, value) => (colour ? `${code}${value}${RESET}` : value);
  const lines = [];
  const { stats } = result;

  if (!quiet) {
    lines.push(c(BOLD, `Report QA: ${meta.source}`));
    const shape = meta.format === 'pptx'
      ? `${stats.slides} slides / ${stats.words} words`
      : `${stats.words} words / ${stats.sentences} sentences / ${stats.headings} headings`;
    lines.push(c(DIM, `${shape}  -  dialect ${describeDialect(stats)}`));
    if (meta.configPath) lines.push(c(DIM, `config: ${meta.configPath}`));
    lines.push('');
  }

  if (!result.findings.length) {
    lines.push('No findings. The mechanical checks are clean.');
    return lines.join('\n');
  }

  let lastSeverity = null;
  for (const finding of result.findings) {
    if (finding.severity !== lastSeverity) {
      lines.push(c(BOLD, `${LABEL[finding.severity]} (${stats.bySeverity[finding.severity]})`));
      lastSeverity = finding.severity;
    }
    const location = locationOf(finding, false);
    lines.push(`  ${c(COLOUR[finding.severity], location.padEnd(9))} ${finding.message}`);
    if (finding.excerpt) lines.push(`  ${' '.repeat(9)} ${c(DIM, finding.excerpt)}`);
    if (finding.suggestion) lines.push(`  ${' '.repeat(9)} ${c(DIM, `→ ${finding.suggestion}`)}`);
    if (finding.note) lines.push(`  ${' '.repeat(9)} ${c(DIM, finding.note)}`);
    lines.push(`  ${' '.repeat(9)} ${c(DIM, finding.rule + (finding.occurrences > 1 ? ` (${finding.occurrences} occurrences)` : ''))}`);
    lines.push('');
  }

  if (!quiet) lines.push(summaryLine(stats, c));
  if (result.errors.length) {
    lines.push('');
    lines.push(c(COLOUR.major, `${result.errors.length} rule(s) failed to run:`));
    for (const error of result.errors) lines.push(`  ${error.rule}: ${error.message}`);
  }
  return lines.join('\n');
}

export function formatMarkdown(result, meta) {
  const { stats, findings } = result;
  const out = [];

  out.push(`# QA report: ${meta.source}`);
  out.push('');
  out.push(`Checked ${meta.now.toISOString().slice(0, 10)} against ${describeDialect(stats)} conventions.`);
  out.push('');
  out.push('| | Count |');
  out.push('|---|---|');
  out.push(`| Blockers | ${stats.bySeverity.blocker} |`);
  out.push(`| Major | ${stats.bySeverity.major} |`);
  out.push(`| Minor | ${stats.bySeverity.minor} |`);
  out.push(`| Nits | ${stats.bySeverity.nit} |`);
  out.push(`| Words | ${stats.words} |`);
  if (stats.slides) out.push(`| Slides | ${stats.slides} |`);
  out.push('');

  if (!findings.length) {
    out.push('No mechanical findings.');
    return out.join('\n');
  }

  if (stats.bySeverity.blocker) {
    out.push('> **Do not issue this draft.** The blockers below include content that must not reach a client.');
    out.push('');
  }

  for (const severity of SEVERITIES) {
    const group = findings.filter((f) => f.severity === severity);
    if (!group.length) continue;
    out.push(`## ${LABEL[severity]} (${group.length})`);
    out.push('');
    for (const finding of group) {
      const location = `**${locationOf(finding, true)}**`;
      out.push(`- ${location} - ${finding.message}`);
      if (finding.excerpt) out.push(`  - Context: \`${finding.excerpt.replace(/`/g, "'")}\``);
      if (finding.suggestion) out.push(`  - Suggested: ${finding.suggestion}`);
      if (finding.note) out.push(`  - ${finding.note}`);
      out.push(`  - <sub>${finding.rule}${finding.occurrences > 1 ? ` - ${finding.occurrences} occurrences` : ''}</sub>`);
    }
    out.push('');
  }

  if (stats.fixable) {
    out.push(`${stats.fixable} of these can be corrected automatically with \`--fix\`.`);
    out.push('');
  }
  return out.join('\n');
}

/**
 * Where a finding is, in terms the author can act on: a slide number in a deck,
 * a line in a document. Speaker notes are called out because a reader of the
 * deck will not see them on the slide.
 */
function locationOf(finding, verbose) {
  if (finding.documentLevel) return verbose ? 'Document' : 'document';
  if (finding.slide) {
    const where = finding.region === 'notes' ? `Slide ${finding.slide} notes` : `Slide ${finding.slide}`;
    return verbose ? where : where.replace('Slide ', 'S');
  }
  return verbose ? `Line ${finding.line}` : `${finding.line}:${finding.column}`;
}

function summaryLine(stats, c) {
  const parts = SEVERITIES
    .filter((s) => stats.bySeverity[s])
    .map((s) => `${stats.bySeverity[s]} ${LABEL[s].toLowerCase()}`);
  const summary = parts.length ? parts.join(', ') : 'nothing';
  const fixable = stats.fixable ? ` - ${stats.fixable} auto-fixable with --fix` : '';
  return c(BOLD, `${stats.total} finding${stats.total === 1 ? '' : 's'}: ${summary}${fixable}`);
}

function describeDialect(stats) {
  if (!stats.dialect) return 'no dialect detected';
  const name = stats.dialect === 'en-GB' ? 'British English' : 'American English';
  const { british, american } = stats.dialectEvidence;
  return `${name} (${british} British / ${american} American spellings)`;
}

/**
 * Comment export format: copy-pasteable text for adding to document/slide comments.
 * Format: "Slide/Line X: [Issue] - [Action required/Optional]"
 */
export function formatComments(result, meta) {
  const { findings } = result;
  if (!findings.length) return '(No findings to report)';

  const lines = [];
  for (const finding of findings) {
    const location = locationOf(finding, true);
    const severity = finding.severity === 'blocker' ? 'ACTION REQUIRED'
      : finding.severity === 'major' ? 'CHANGE REQUIRED'
        : finding.severity === 'minor' ? 'Please fix'
          : 'Optional improvement';

    lines.push(`${location}: ${finding.message}`);
    lines.push(`Status: ${severity}`);
    if (finding.suggestion) lines.push(`Action: ${finding.suggestion}`);
    if (finding.note) lines.push(`Note: ${finding.note}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Summary document: clean, structured report with blockers first.
 * Suitable for emailing to consultant with findings grouped by criticality.
 */
export function formatSummaryDocument(result, meta) {
  const { stats, findings } = result;
  const out = [];

  out.push(`QA Summary: ${meta.source}`);
  out.push('='.repeat(60));
  out.push('');
  out.push(`Checked: ${meta.now.toISOString().slice(0, 10)}`);
  out.push(`Dialect: ${describeDialect(stats)}`);
  out.push('');

  out.push('OVERVIEW');
  out.push('-'.repeat(60));
  out.push(`Total findings: ${stats.total}`);
  if (stats.bySeverity.blocker) out.push(`  • Blockers (must fix): ${stats.bySeverity.blocker}`);
  if (stats.bySeverity.major) out.push(`  • Major issues (change required): ${stats.bySeverity.major}`);
  if (stats.bySeverity.minor) out.push(`  • Minor issues (inconsistent): ${stats.bySeverity.minor}`);
  if (stats.bySeverity.nit) out.push(`  • Nits (optional): ${stats.bySeverity.nit}`);
  out.push('');

  if (!findings.length) {
    out.push('No findings. This document is mechanically sound.');
    return out.join('\n');
  }

  // Blockers first - these must be fixed
  const blockerGroup = findings.filter((f) => f.severity === 'blocker');
  if (blockerGroup.length) {
    out.push('CRITICAL: DO NOT SEND - Fix these first');
    out.push('='.repeat(60));
    for (const finding of blockerGroup) {
      const location = locationOf(finding, true);
      out.push(`• ${location}`);
      out.push(`  Issue: ${finding.message}`);
      if (finding.suggestion) out.push(`  Fix: ${finding.suggestion}`);
      if (finding.note) out.push(`  Note: ${finding.note}`);
      out.push('');
    }
  }

  // Major issues
  const majorGroup = findings.filter((f) => f.severity === 'major');
  if (majorGroup.length) {
    out.push('MAJOR ISSUES: Needs correction');
    out.push('='.repeat(60));
    for (const finding of majorGroup) {
      const location = locationOf(finding, true);
      out.push(`• ${location}`);
      out.push(`  Issue: ${finding.message}`);
      if (finding.suggestion) out.push(`  Fix: ${finding.suggestion}`);
      if (finding.note) out.push(`  Note: ${finding.note}`);
      out.push('');
    }
  }

  // Minor issues
  const minorGroup = findings.filter((f) => f.severity === 'minor');
  if (minorGroup.length) {
    out.push('MINOR ISSUES: Consistency and polish');
    out.push('='.repeat(60));
    for (const finding of minorGroup) {
      const location = locationOf(finding, true);
      out.push(`• ${location}`);
      out.push(`  Issue: ${finding.message}`);
      if (finding.suggestion) out.push(`  Fix: ${finding.suggestion}`);
      out.push('');
    }
  }

  // Nits
  const nitGroup = findings.filter((f) => f.severity === 'nit');
  if (nitGroup.length) {
    out.push('OPTIONAL: Nice-to-haves');
    out.push('='.repeat(60));
    for (const finding of nitGroup) {
      const location = locationOf(finding, true);
      out.push(`• ${location}: ${finding.message}`);
      if (finding.suggestion) out.push(`  Suggestion: ${finding.suggestion}`);
      out.push('');
    }
  }

  return out.join('\n');
}

/**
 * Blocker-only filter: shows only critical findings that must not reach client.
 * Used for quick decision: can we send this, or not?
 */
export function formatBlockersOnly(result, meta) {
  const { stats, findings } = result;
  const blockers = findings.filter((f) => f.severity === 'blocker');

  if (!blockers.length) {
    return `✓ CLEAR TO SEND\n\nNo blockers found. This document may be issued to the client.\n\n${stats.total} minor${stats.total === 1 ? '' : 's'} to review if you have time.`;
  }

  const out = [];
  out.push('✗ DO NOT SEND');
  out.push('');
  out.push(`${blockers.length} blocker${blockers.length === 1 ? '' : 's'} found. These must be fixed before sending to client:`);
  out.push('');

  for (const finding of blockers) {
    const location = locationOf(finding, true);
    out.push(`▸ ${location}`);
    out.push(`  ${finding.message}`);
    if (finding.suggestion) out.push(`  → ${finding.suggestion}`);
    out.push('');
  }

  const others = stats.total - blockers.length;
  if (others) {
    out.push(`---`);
    out.push(`Also ${others} non-critical issue${others === 1 ? '' : 's'} to review.`);
  }

  return out.join('\n');
}
