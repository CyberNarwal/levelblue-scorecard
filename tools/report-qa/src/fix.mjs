/**
 * Automatic correction of the unambiguous findings.
 *
 * Only findings whose rule declares `fixable`, that carry a concrete
 * replacement, and that the rule rated high confidence are applied. Anything
 * requiring judgement - rewriting a hedged recommendation, renaming a product,
 * resolving a contradictory statistic - is left for a person.
 *
 * Edits are applied back-to-front so earlier offsets stay valid, and any edit
 * overlapping one already applied is skipped rather than corrupting the text.
 */

export function applyFixes(doc, findings) {
  const applicable = findings
    .filter((f) => f.fixable && typeof f.fix === 'string' && f.confidence === 'high')
    .sort((a, b) => b.start - a.start);

  // Never rewrite inside a span a rule flagged as sensitive. A credential or a
  // personal identifier is data, not prose: "correcting" its punctuation
  // silently changes the value, which is worse than leaving it alone. It has to
  // be removed by hand anyway.
  const protectedSpans = findings
    .filter((f) => f.redact)
    .map((f) => [f.start, f.end]);
  const isProtected = (start, end) => protectedSpans.some(([from, to]) => start < to && from < end);

  let text = doc.text;
  const applied = [];
  const skipped = [];
  let lastStart = Number.POSITIVE_INFINITY;

  for (const finding of applicable) {
    if (finding.end > lastStart) {
      skipped.push({ ...finding, reason: 'overlaps another fix' });
      continue;
    }
    if (isProtected(finding.start, finding.end)) {
      skipped.push({ ...finding, reason: 'inside a span flagged as sensitive' });
      continue;
    }
    const before = text.slice(finding.start, finding.end);
    text = text.slice(0, finding.start) + finding.fix + text.slice(finding.end);
    applied.push({ rule: finding.rule, line: finding.line, before, after: finding.fix });
    lastStart = finding.start;
  }

  return { text, applied: applied.reverse(), skipped };
}

/** Findings a person still has to deal with after --fix has run. */
export function remaining(findings) {
  return findings.filter((f) => !(f.fixable && typeof f.fix === 'string' && f.confidence === 'high'));
}
