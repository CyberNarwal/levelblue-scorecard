/**
 * Low-level text utilities shared by every rule.
 *
 * The whole engine works on a single normalised string plus absolute character
 * offsets. Everything that reports a position converts an offset to a
 * line/column pair at the last moment, so rules never have to think about
 * line splitting.
 */

/** Characters Word and Outlook love to smuggle into a draft. */
export const INVISIBLES = {
  ['\u00A0']: { name: 'no-break space', replacement: ' ' },
  ['\u2007']: { name: 'figure space', replacement: ' ' },
  ['\u202F']: { name: 'narrow no-break space', replacement: ' ' },
  ['\u2009']: { name: 'thin space', replacement: ' ' },
  ['\u200A']: { name: 'hair space', replacement: ' ' },
  ['\u200B']: { name: 'zero-width space', replacement: '' },
  ['\u200C']: { name: 'zero-width non-joiner', replacement: '' },
  ['\u200D']: { name: 'zero-width joiner', replacement: '' },
  ['\u2060']: { name: 'word joiner', replacement: '' },
  ['\uFEFF']: { name: 'zero-width no-break space (BOM)', replacement: '' },
  ['\u00AD']: { name: 'soft hyphen', replacement: '' },
};

export const SMART_QUOTES = {
  ['\u2018']: "'", ['\u2019']: "'", ['\u201A']: "'", ['\u201B']: "'",
  ['\u201C']: '"', ['\u201D']: '"', ['\u201E']: '"', ['\u201F']: '"',
};

/**
 * Normalise line endings and strip a leading BOM without changing the length
 * of anything else, so offsets stay meaningful against the source.
 */
export function normaliseNewlines(raw) {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Offsets at which each line starts. Index 0 is line 1. */
export function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

/** Binary search an offset back to a 1-based {line, column}. */
export function offsetToPosition(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineStarts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low + 1, column: offset - lineStarts[low] + 1 };
}

/**
 * Abbreviations that end in a full stop without ending a sentence. Without
 * these, sentence-level rules mis-split on every "e.g." and "Ltd." in a report.
 */
const ABBREVIATIONS = new Set([
  'al', 'approx', 'appt', 'apr', 'aug', 'ave', 'capt', 'cf', 'co', 'corp',
  'dec', 'dept', 'dr', 'eg', 'e.g', 'est', 'etc', 'feb', 'fig', 'figs', 'gen',
  'gov', 'hr', 'hrs', 'ie', 'i.e', 'inc', 'jan', 'jul', 'jun', 'llc', 'lt',
  'ltd', 'mar', 'max', 'messrs', 'min', 'misc', 'mr', 'mrs', 'ms', 'mt', 'no',
  'nos', 'nov', 'oct', 'para', 'phd', 'plc', 'pp', 'prof', 'pty', 'rev', 'sec',
  'sep', 'sept', 'sr', 'st', 'viz', 'vol', 'vs',
]);

/** True when the full stop at `index` is part of an abbreviation or a number. */
function isNonTerminalPeriod(text, index) {
  // Decimal numbers, version strings, IPs: 9.8 / v2.1.3 / 10.0.0.1
  if (/\d/.test(text[index - 1] || '') && /\d/.test(text[index + 1] || '')) return true;
  const before = text.slice(Math.max(0, index - 24), index);
  // Single-letter initials and dotted acronyms: J. Smith, U.S., i.e.
  if (/(?:^|[\s("'‘“])[A-Za-z]$/.test(before)) return true;
  const word = (before.match(/[A-Za-z.]+$/) || [''])[0].replace(/^\.+/, '');
  return ABBREVIATIONS.has(word.toLowerCase());
}

/**
 * Split a block of prose into sentences, returning absolute offsets.
 * `base` is the offset of `text` within the whole document.
 */
export function splitSentences(text, base = 0) {
  const sentences = [];
  const push = (from, to) => {
    const raw = text.slice(from, to);
    if (!raw.trim()) return;
    const lead = raw.length - raw.trimStart().length;
    sentences.push({
      text: raw.trim(),
      start: base + from + lead,
      end: base + from + raw.trimEnd().length,
    });
  };

  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    if (ch === '.' && isNonTerminalPeriod(text, i)) continue;
    // Absorb trailing quotes, brackets and repeated terminators.
    let end = i + 1;
    while (end < text.length && /[.!?)\]"'’”]/.test(text[end])) end += 1;
    // A sentence boundary needs whitespace (or end of block) after it.
    if (end < text.length && !/\s/.test(text[end])) continue;
    push(start, end);
    while (end < text.length && /\s/.test(text[end])) end += 1;
    start = end;
    i = end - 1;
  }
  push(start, text.length);
  return sentences;
}

/** Word count that ignores punctuation-only tokens. */
export function countWords(text) {
  const matches = text.match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g);
  return matches ? matches.length : 0;
}

/** Rough syllable estimate - good enough for a readability index, not phonetics. */
export function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Flesch Reading Ease. Higher is easier; an executive summary should sit
 * above ~40, technical detail may legitimately sit lower.
 */
export function fleschReadingEase(sentences) {
  let words = 0;
  let syllables = 0;
  let count = 0;
  for (const sentence of sentences) {
    const tokens = sentence.text.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    if (!tokens.length) continue;
    count += 1;
    words += tokens.length;
    for (const token of tokens) syllables += countSyllables(token);
  }
  if (!count || !words) return null;
  return 206.835 - 1.015 * (words / count) - 84.6 * (syllables / words);
}

/** Escape a string for safe interpolation into a RegExp. */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Preserve the casing pattern of `original` when applying `replacement`.
 * "Organisation" -> "Organization", "ORGANISATION" -> "ORGANIZATION".
 */
export function matchCase(original, replacement) {
  if (original === original.toUpperCase() && /[A-Z]{2,}/.test(original)) {
    return replacement.toUpperCase();
  }
  if (/^[A-Z]/.test(original)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** A short, single-line excerpt centred on an offset, for the finding output. */
export function excerptAround(text, start, end, radius = 40) {
  const { before, match, after } = excerptPartsAround(text, start, end, radius);
  // A flagged span can run across a line break; the flat form is one line.
  return `${before}${match}${after}`.replace(/\s*\n\s*/g, ' ');
}

/** A flagged span longer than this is cut, so one long sentence cannot fill the list. */
const MAX_MATCH = 160;
/** How far the window may move to avoid cutting a word in half. */
const SNAP = 15;

/** Move the window's left edge right, off the middle of a word. */
function snapStart(text, index, limit) {
  const stop = Math.min(index + SNAP, limit);
  for (let i = index; i < stop; i += 1) {
    if (/\s/.test(text[i])) return i + 1;
  }
  return index;
}

/** Move the window's right edge left, off the middle of a word. */
function snapEnd(text, index, limit) {
  const stop = Math.max(index - SNAP, limit);
  for (let i = index; i > stop; i -= 1) {
    if (/\s/.test(text[i - 1])) return i - 1;
  }
  return index;
}

/**
 * The same excerpt as `excerptAround`, split at the flagged span so a reader can
 * be shown the exact text the rule objected to rather than a window it sits
 * somewhere inside. `match` is the flagged text verbatim; `before` and `after`
 * are the surrounding context that makes it locatable in the draft.
 */
export function excerptPartsAround(text, start, end, radius = 40) {
  const clamped = Math.max(0, Math.min(start, text.length));
  const clampedEnd = Math.max(clamped, Math.min(end, text.length));

  // The window starts and ends on a word boundary where it can, so the context
  // reads as words rather than as the tail of one.
  const rawFrom = Math.max(0, clamped - radius);
  const rawTo = Math.min(text.length, clampedEnd + radius);
  const from = rawFrom > 0 ? snapStart(text, rawFrom, clamped) : 0;
  const to = rawTo < text.length ? snapEnd(text, rawTo, clampedEnd) : text.length;

  // Context is collapsed to keep the row to one line, but the flagged span is
  // kept verbatim: for a double space or a stray tab the whitespace IS the
  // finding, and collapsing it would hide the very thing being reported.
  const before = text.slice(from, clamped).replace(/\s+/g, ' ').replace(/^ /, '');
  const after = text.slice(clampedEnd, to).replace(/\s+/g, ' ').replace(/ $/, '');
  let match = text.slice(clamped, clampedEnd);
  if (match.length > MAX_MATCH) match = `${match.slice(0, MAX_MATCH)}…`;

  return {
    before: from > 0 ? `...${before}` : before,
    match,
    after: to < text.length ? `${after}...` : after,
  };
}
