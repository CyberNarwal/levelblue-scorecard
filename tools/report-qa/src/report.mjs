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
    lines.push(c(DIM, `${stats.words} words / ${stats.sentences} sentences / ${stats.headings} headings  -  dialect ${describeDialect(stats)}`));
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
    const location = finding.documentLevel ? 'document' : `${finding.line}:${finding.column}`;
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
      const location = finding.documentLevel ? '**Document**' : `**Line ${finding.line}**`;
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
