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
      excerptParts: f.excerptParts,
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

  const dismissed = dismissedLine(meta);
  if (dismissed) {
    out.push(dismissed);
    out.push('');
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
 * The exact run of text the rule objected to, which is what an author needs in
 * order to find it in their own draft. Document-level findings have no span.
 */
function flagged(finding) {
  const match = finding.excerptParts?.match?.replace(/\s+/g, ' ').trim();
  return match || null;
}

/** A replacement that is only whitespace has to be quoted or it reads as nothing. */
function fixOf(finding) {
  if (!finding.suggestion) return null;
  return /^\s*$/.test(finding.suggestion) ? `"${finding.suggestion}"` : finding.suggestion;
}

/**
 * Findings the reviewer set aside are left out of these formats, so the count
 * is stated rather than left for the reader to notice is missing.
 */
function dismissedLine(meta) {
  if (!meta.dismissed) return null;
  return `${meta.dismissed} further finding${meta.dismissed === 1 ? '' : 's'} `
    + 'judged not to apply and left out.';
}

const ASK = {
  blocker: 'ACTION REQUIRED',
  major: 'CHANGE REQUIRED',
  minor: 'Please fix',
  nit: 'Optional',
};

/**
 * One comment per finding, to paste into the comment bubble on the slide or
 * paragraph it belongs to. The flagged words lead, because the author is
 * reading this beside their own text and needs to match it up.
 */
export function formatComments(result, meta) {
  const { findings } = result;
  if (!findings.length) return 'No findings.';

  const lines = [];
  for (const finding of findings) {
    const quote = flagged(finding);
    lines.push(`${locationOf(finding, true)} | ${ASK[finding.severity]}`);
    if (quote) lines.push(`Found: "${quote}"`);
    lines.push(`Issue: ${finding.message}`);
    const fix = fixOf(finding);
    if (fix) lines.push(`Fix: ${fix}`);
    if (finding.note) lines.push(`Note: ${finding.note}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

const SECTION = {
  blocker: 'MUST FIX BEFORE ISSUE',
  major: 'WRONG, OR READS AS WRONG',
  minor: 'INCONSISTENT',
  nit: 'OPTIONAL',
};

/**
 * A summary to attach to the mail back to the author: one line per finding,
 * quoting their own words, ordered so the things that stop the deliverable
 * going out are read first.
 */
export function formatSummaryDocument(result, meta) {
  const { stats, findings } = result;
  const out = [];

  out.push(`QA summary: ${meta.source}`);
  out.push(`Checked ${meta.now.toISOString().slice(0, 10)} against ${describeDialect(stats)} conventions.`);
  out.push('');

  const dismissed = dismissedLine(meta);

  if (!findings.length) {
    out.push('No mechanical findings. Read it for argument and accuracy before issuing.');
    if (dismissed) out.push(dismissed);
    return out.join('\n');
  }

  const tally = SEVERITIES
    .filter((s) => stats.bySeverity[s])
    .map((s) => `${stats.bySeverity[s]} ${LABEL[s].toLowerCase()}`);
  out.push(`${stats.total} finding${stats.total === 1 ? '' : 's'}: ${tally.join(', ')}.`);
  if (dismissed) out.push(dismissed);
  if (stats.bySeverity.blocker) {
    out.push('Do not issue this draft until the first section is clear.');
  }
  out.push('');

  for (const severity of SEVERITIES) {
    const group = findings.filter((f) => f.severity === severity);
    if (!group.length) continue;

    out.push(`${SECTION[severity]} (${group.length})`);
    out.push('-'.repeat(SECTION[severity].length + 6));
    for (const finding of group) {
      const quote = flagged(finding);
      const fix = fixOf(finding);
      out.push(`${locationOf(finding, true)} - ${finding.message}`);
      if (quote) out.push(`    "${quote}"${fix ? `  ->  ${fix}` : ''}`);
      else if (fix) out.push(`    ->  ${fix}`);
      if (finding.note) out.push(`    ${finding.note}`);
    }
    out.push('');
  }

  return out.join('\n').trimEnd();
}

/**
 * Blocker-only filter: shows only critical findings that must not reach client.
 * Used for quick decision: can we send this, or not?
 */
export function formatBlockersOnly(result, meta) {
  const { stats, findings } = result;
  const blockers = findings.filter((f) => f.severity === 'blocker');
  const others = stats.total - blockers.length;
  const rest = others
    ? `${others} lesser finding${others === 1 ? '' : 's'} to review.`
    : 'Nothing else outstanding.';
  const dismissed = dismissedLine(meta);

  if (!blockers.length) {
    return [
      `NO BLOCKERS: ${meta.source}`,
      '',
      'Nothing in this draft is of the kind that must not reach a client.',
      rest,
      ...(dismissed ? [dismissed] : []),
    ].join('\n');
  }

  const out = [];
  out.push(`DO NOT ISSUE: ${meta.source}`);
  out.push('');
  out.push(`${blockers.length} blocker${blockers.length === 1 ? '' : 's'} must be cleared first.`);
  out.push('');

  for (const finding of blockers) {
    const quote = flagged(finding);
    out.push(`${locationOf(finding, true)} - ${finding.message}`);
    if (quote) out.push(`    "${quote}"`);
    const fix = fixOf(finding);
    if (fix) out.push(`    ->  ${fix}`);
    out.push('');
  }

  out.push(rest);
  if (dismissed) out.push(dismissed);
  return out.join('\n');
}
