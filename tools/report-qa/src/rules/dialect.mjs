/**
 * UK/US English consistency.
 *
 * The tool does not care which dialect a report is written in - it cares that
 * the report picks one. When no dialect is configured, the majority usage in
 * the draft is taken as the intended one and the minority spellings are
 * reported, which is almost always what a reviewer actually wants.
 */

import { buildDialectIndex, DATE_PATTERNS, suffixDialect } from '../data/dialect.mjs';
import { matchCase } from '../text.mjs';

const { gb: GB_INDEX, us: US_INDEX } = buildDialectIndex();
const SCOPE = ['paragraph', 'listItem', 'heading', 'caption', 'tableRow'];

/**
 * Walk every word in the draft and classify it as British, American or neutral.
 * Shared by the detection pass and the reporting rule.
 */
export function collectDialectEvidence(doc) {
  const hits = [];
  const covered = new Set();

  // Multi-word pairs first ("cyber security" vs "cybersecurity"), so the
  // single-word pass does not report their component words separately.
  for (const [lower, pair] of [...GB_INDEX, ...US_INDEX]) {
    if (!lower.includes(' ')) continue;
    const pattern = new RegExp(`\\b${lower.replace(/ /g, '\\s+')}\\b`, 'gi');
    for (const { match, start, end } of doc.scan(pattern, { types: SCOPE })) {
      if (covered.has(start)) continue;
      const isGb = lower === pair.gb.toLowerCase();
      for (let i = start; i < end; i += 1) covered.add(i);
      hits.push({
        start,
        end,
        word: match[0],
        dialect: isGb ? 'en-GB' : 'en-US',
        counterpart: matchCase(match[0], isGb ? pair.us : pair.gb),
        pair,
      });
    }
  }

  for (const { match, start, end } of doc.scan(/\b[A-Za-z]+\b/g, { types: SCOPE })) {
    if (covered.has(start)) continue;
    const word = match[0];
    const lower = word.toLowerCase();

    const gbPair = GB_INDEX.get(lower);
    if (gbPair) {
      hits.push({ start, end, word, dialect: 'en-GB', counterpart: matchCase(word, gbPair.us), pair: gbPair });
      continue;
    }
    const usPair = US_INDEX.get(lower);
    if (usPair) {
      hits.push({ start, end, word, dialect: 'en-US', counterpart: matchCase(word, usPair.gb), pair: usPair });
      continue;
    }

    const suffix = suffixDialect(word);
    if (suffix) {
      hits.push({ start, end, word, dialect: suffix.dialect, counterpart: suffix.counterpart, pair: null });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/** Decide the report's dialect from its own spellings. */
export function detectDialect(doc) {
  const hits = collectDialectEvidence(doc);
  let gb = 0;
  let us = 0;
  for (const hit of hits) {
    if (hit.pair && hit.pair.confidence === 'low') continue;
    if (hit.dialect === 'en-GB') gb += 1; else us += 1;
  }
  if (gb === 0 && us === 0) return { dialect: null, gb, us, hits };
  return { dialect: gb >= us ? 'en-GB' : 'en-US', gb, us, hits };
}

export const rules = [
  {
    id: 'dialect/mixed-spelling',
    title: 'Spelling does not match the report dialect',
    category: 'Dialect',
    severity: 'major',
    fixable: true,
    check(doc, ctx) {
      const hits = ctx.dialectEvidence ?? collectDialectEvidence(doc);
      const target = ctx.dialect;
      if (!target) return [];
      const lower = doc.text.toLowerCase();

      /**
       * A low-confidence pair is one where both spellings are ordinary words in
       * their own right - "draft" and "draught", "check" and "cheque",
       * "practice" and "practise". Reporting one of those on sight tells an
       * author their correct word is wrong, and an advisory report is full of
       * drafts and checks. They are only worth raising when the draft uses both
       * forms, which is a real inconsistency rather than a guess about meaning.
       */
      const worthReporting = (hit) => {
        if (hit.pair?.confidence !== 'low') return true;
        return new RegExp(`\\b${hit.counterpart.toLowerCase()}\\b`).test(lower);
      };

      return hits
        .filter((hit) => hit.dialect !== target && worthReporting(hit))
        .map((hit) => ({
          start: hit.start,
          end: hit.end,
          message: `"${hit.word}" is ${hit.dialect === 'en-GB' ? 'British' : 'American'} spelling; this report is ${target === 'en-GB' ? 'British' : 'American'}.`,
          suggestion: hit.counterpart,
          fix: hit.counterpart,
          note: hit.pair?.note,
          severity: hit.pair?.confidence === 'low' ? 'minor' : 'major',
          confidence: hit.pair?.confidence === 'low' ? 'medium' : 'high',
        }));
    },
  },

  {
    id: 'dialect/date-format',
    title: 'Date format does not match the report dialect',
    category: 'Dialect',
    severity: 'minor',
    check(doc, ctx) {
      const findings = [];
      const target = ctx.dialect || ctx.config.dialect;
      const dayFirst = [...doc.scan(DATE_PATTERNS.dayMonthYear, { types: SCOPE })];
      const monthFirst = [...doc.scan(DATE_PATTERNS.monthDayYear, { types: SCOPE })];

      if (dayFirst.length && monthFirst.length) {
        const offenders = target === 'en-US' ? dayFirst : monthFirst;
        findings.push({
          start: offenders[0].start,
          end: offenders[0].end,
          message: `Mixed date formats: ${dayFirst.length} as "12 March 2026" and ${monthFirst.length} as "March 12, 2026". ${target === 'en-US' ? 'US' : 'UK'} convention is ${target === 'en-US' ? '"March 12, 2026"' : '"12 March 2026"'}.`,
          aggregate: true,
          occurrences: offenders.length,
        });
      }

      // A purely numeric date is ambiguous across the Atlantic - 03/04/2026 is
      // two different days depending on who reads it.
      for (const { match, start, end } of doc.scan(DATE_PATTERNS.ambiguousNumeric, { types: SCOPE })) {
        const a = Number(match[1]);
        const b = Number(match[2]);
        if (a > 12 && b > 12) continue;
        if (match[3].length === 4 && a > 31) continue; // looks like a version or ratio
        findings.push({
          start,
          end,
          message: `"${match[0]}" is ambiguous: UK reads it as ${a} ${monthName(b)}, US as ${monthName(a)} ${b}.`,
          suggestion: 'Write the month in words.',
          severity: 'major',
        });
      }
      return findings;
    },
  },

  {
    id: 'dialect/abbreviation-style',
    title: 'Abbreviation punctuation does not match the dialect',
    category: 'Dialect',
    severity: 'nit',
    check(doc, ctx) {
      const findings = [];
      const british = ctx.dialect !== 'en-US';
      // UK style drops the full stop in contractions that end in the final
      // letter of the word: Mr, Dr, Ltd. US style keeps it.
      const pattern = british ? /\b(Mr|Mrs|Dr|Ltd|St)\./g : /\b(Mr|Mrs|Dr|Ltd|St)\b(?!\.)/g;
      for (const { match, start, end } of doc.scan(pattern, { types: SCOPE })) {
        findings.push({
          start,
          end,
          message: british
            ? `UK style writes "${match[1]}" without a full stop.`
            : `US style writes "${match[1]}." with a full stop.`,
          suggestion: british ? match[1] : `${match[1]}.`,
        });
      }

      // "e.g." and "i.e." take a following comma in US style and are commonly
      // bare in UK style, but the stops themselves are required in both.
      for (const { match, start, end } of doc.scan(/\b(eg|ie)\b(?!\.)/g, { types: SCOPE })) {
        findings.push({
          start,
          end,
          message: `"${match[1]}" should be punctuated "${match[1][0]}.${match[1][1]}."`,
          suggestion: `${match[1][0]}.${match[1][1]}.`,
          severity: 'minor',
        });
      }
      return findings;
    },
  },

  {
    id: 'dialect/collective-agreement',
    title: 'Collective-noun agreement differs between dialects',
    category: 'Dialect',
    severity: 'nit',
    check(doc, ctx) {
      if (ctx.dialect !== 'en-US') return [];
      const findings = [];
      const pattern = /\b(the (?:team|board|committee|organisation|organization|company|group|government)|staff)\s+(are|were|have)\b/gi;
      for (const { match, start, end } of doc.scan(pattern, { types: SCOPE })) {
        findings.push({
          start,
          end,
          message: `US English treats collective nouns as singular: "${match[1]} ${singularise(match[2])}".`,
          suggestion: `${match[1]} ${singularise(match[2])}`,
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'dialect/data-agreement',
    title: 'Inconsistent treatment of "data"',
    category: 'Dialect',
    severity: 'nit',
    check(doc) {
      const singular = [...doc.scan(/\bdata\s+(?:is|was|has)\b/gi, { types: SCOPE })];
      const plural = [...doc.scan(/\bdata\s+(?:are|were|have)\b/gi, { types: SCOPE })];
      if (!singular.length || !plural.length) return [];
      const offenders = singular.length >= plural.length ? plural : singular;
      return [{
        start: offenders[0].start,
        end: offenders[0].end,
        message: `"data" is treated as singular ${singular.length} time${singular.length === 1 ? '' : 's'} and plural ${plural.length} time${plural.length === 1 ? '' : 's'}. Pick one - singular is standard in modern technical writing.`,
        aggregate: true,
        occurrences: offenders.length,
      }];
    },
  },
];

function singularise(verb) {
  return { are: 'is', were: 'was', have: 'has' }[verb.toLowerCase()] || verb;
}

function monthName(n) {
  return ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'][n] || `month ${n}`;
}
