/**
 * Terminology rules: canonical product and standard names, acronym discipline,
 * and internal consistency in how the report refers to the same thing twice.
 */

import { ACRONYM_EXPANSIONS, CANONICAL_TERMS, COMMON_ACRONYMS, identifierSpans } from '../data/terms.mjs';

const SCOPE = ['paragraph', 'listItem', 'heading', 'caption', 'tableRow'];

/**
 * True when the text before a word is a position that forces a capital: the
 * start of the block, the end of a sentence, a table cell boundary, a bullet
 * marker or a colon.
 */
function opensAClause(before) {
  const trimmed = before.replace(/\s+$/, '');
  if (!trimmed) return true;
  if (/[.!?:|\u2022]$/.test(trimmed)) return true;
  return /^\s*(?:[-*\u2022]|\d+[.)]|[a-z][.)])$/.test(trimmed);
}

/** Framework terms whose second word is capitalised because it is a name. */
const NAMED_TERM = /\b(?:CIS|PCI\s?DSS|ISO(?:\/IEC)?|NIST|SOC\s?2|Annex)\s+[A-Z][a-z]+$/;

export const rules = [
  {
    id: 'terminology/canonical-name',
    title: 'Non-standard product, vendor or standard name',
    category: 'Terminology',
    severity: 'minor',
    check(doc, ctx) {
      const findings = [];
      const allowed = new Set((ctx.config.allowedTerms || []).map((t) => t.toLowerCase()));
      for (const entry of CANONICAL_TERMS) {
        for (const { match, start, end } of doc.scan(entry.wrong, { types: SCOPE })) {
          if (match[0] === entry.right) continue;
          if (allowed.has(match[0].toLowerCase())) continue;
          findings.push({
            start,
            end,
            message: `"${match[0]}" - house style is "${entry.right}".`,
            suggestion: entry.right,
            note: entry.note,
            severity: entry.severity,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'terminology/acronym-not-expanded',
    title: 'Acronym used without expansion',
    category: 'Terminology',
    severity: 'major',
    check(doc, ctx) {
      const firstUse = new Map();
      const expanded = new Set();
      const allowed = new Set([
        ...COMMON_ACRONYMS,
        ...(ctx.config.knownAcronyms || []),
      ].map((a) => a.toUpperCase()));

      for (const { match, start, end, block } of doc.scan(/\b([A-Z]{2,6})(?:2\.0|\d)?\b/g, { types: SCOPE })) {
        const acronym = match[1];
        if (allowed.has(acronym)) continue;

        const before = block.text.slice(Math.max(0, match.index - 90), match.index);
        const after = block.text.slice(match.index + match[0].length, match.index + match[0].length + 90);

        // Not an acronym at all: a fragment of a structured identifier
        // (GV.OC-01, T1558.003), a template placeholder, or part of a proper
        // product name whose previous word is already capitalised.
        if (/[.\-/]$/.test(before) || /^[.\-/][A-Za-z0-9]/.test(after)) continue;
        if (/\[[^\]]*$/.test(before)) continue;
        if (/\b[A-Z][A-Za-z]+\s$/.test(before)) continue;

        // An expansion may sit either side of the acronym:
        //   "multi-factor authentication (MFA)" or "MFA (multi-factor authentication)"
        const parenthesised = /\(\s*$/.test(before) || /^\s*\(/.test(after);
        if (parenthesised && looksLikeExpansion(acronym, before, after)) {
          expanded.add(acronym);
          continue;
        }
        if (!firstUse.has(acronym)) firstUse.set(acronym, { start, end, count: 1 });
        else firstUse.get(acronym).count += 1;
      }

      const findings = [];
      for (const [acronym, use] of firstUse) {
        if (expanded.has(acronym)) continue;
        const known = ACRONYM_EXPANSIONS[acronym];
        // Report domain jargon we can name an expansion for, and otherwise only
        // acronyms used often enough to be load-bearing. Guessing at every
        // capitalised token buries the real findings.
        if (!known && use.count < 3) continue;
        findings.push({
          start: use.start,
          end: use.end,
          message: `"${acronym}" is used ${use.count} time${use.count === 1 ? '' : 's'} without ever being expanded.`,
          suggestion: known ? `${known} (${acronym})` : `Expand on first use: "<expansion> (${acronym})".`,
          aggregate: true,
          occurrences: use.count,
        });
      }
      return findings;
    },
  },

  {
    id: 'terminology/acronym-re-expanded',
    title: 'Acronym expanded more than once',
    category: 'Terminology',
    severity: 'nit',
    check(doc) {
      const findings = [];
      const seen = new Map();
      for (const { match, start, end } of doc.scan(/\(\s*([A-Z]{2,6})\s*\)/g, { types: SCOPE })) {
        const acronym = match[1];
        if (!seen.has(acronym)) { seen.set(acronym, 1); continue; }
        seen.set(acronym, seen.get(acronym) + 1);
        findings.push({
          start,
          end,
          message: `"${acronym}" is expanded again here; it was already defined earlier.`,
          suggestion: `Use "${acronym}" on its own after the first definition.`,
        });
      }
      return findings;
    },
  },

  {
    id: 'terminology/acronym-defined-unused',
    title: 'Acronym defined but never used again',
    category: 'Terminology',
    severity: 'nit',
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/\(\s*([A-Z]{2,6})\s*\)/g, { types: SCOPE })) {
        const acronym = match[1];
        const uses = (doc.text.match(new RegExp(`\\b${acronym}\\b`, 'g')) || []).length;
        // The definition contributes one occurrence, not two: the expansion
        // beside it is words, not the letters. Counting it twice meant an
        // acronym defined and then used once was reported as never used.
        if (uses > 1) continue;
        findings.push({
          start,
          end,
          message: `"${acronym}" is defined here but never used again. Either use the acronym or drop the definition.`,
        });
      }
      return findings;
    },
  },

  {
    id: 'terminology/acronym-expansion-mismatch',
    title: 'Acronym expansion does not match the usual meaning',
    category: 'Terminology',
    severity: 'major',
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/([A-Za-z][A-Za-z\s,'-]{8,70}?)\s*\(\s*([A-Z]{2,6})\s*\)/g, { types: SCOPE })) {
        const acronym = match[2];
        const expected = ACRONYM_EXPANSIONS[acronym];
        if (!expected) continue;
        const given = match[1].trim().toLowerCase();
        if (!given) continue;
        const expectedWords = expected.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
        const givenWords = given.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
        const tail = givenWords.slice(-expectedWords.length);
        const overlap = expectedWords.filter((w) => tail.includes(w)).length / expectedWords.length;
        if (overlap >= 0.5) continue;
        findings.push({
          start,
          end,
          message: `"${acronym}" is expanded as "${match[1].trim()}", which does not match the usual expansion "${expected}".`,
          suggestion: `${expected} (${acronym})`,
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'terminology/inconsistent-capitalisation',
    title: 'The same term is capitalised differently',
    category: 'Terminology',
    severity: 'minor',
    check(doc) {
      const variants = new Map();
      const names = identifierSpans(doc.text);
      const insideName = (from, to) => names.some(([s, e]) => from < e && to > s);
      for (const { match, start, end, block } of doc.scan(/\b[A-Za-z][A-Za-z-]{4,24}\b/g, { types: SCOPE })) {
        const word = match[0];
        const key = word.toLowerCase();
        if (!variants.has(key)) variants.set(key, new Map());
        const forms = variants.get(key);
        // A capital forced by its position says nothing about house style. That
        // is not only the start of a sentence: a table cell, a bullet and the
        // text after a colon all open with one too, and reading those as a
        // choice reported every heading-style table cell in the report.
        if (opensAClause(block.text.slice(0, match.index)) && /^[A-Z][a-z]+$/.test(word)) continue;
        // An ALL-CAPS form is a marking, a file name or an acronym - DEMO DRAFT
        // beside "draft" - not a decision about how to capitalise the word.
        if (word === word.toUpperCase()) continue;
        if (block.type === 'heading') continue;
        // "CIS Control 11" and "PCI DSS 8.4" are names, not capitalisation.
        if (insideName(start, end)) continue;
        if (NAMED_TERM.test(block.text.slice(Math.max(0, match.index - 14), end - block.start))) continue;
        if (!forms.has(word)) forms.set(word, { count: 0, start, end });
        forms.get(word).count += 1;
      }

      const findings = [];
      for (const forms of variants.values()) {
        if (forms.size < 2) continue;
        const entries = [...forms.entries()].sort((a, b) => b[1].count - a[1].count);
        const total = entries.reduce((sum, [, v]) => sum + v.count, 0);
        if (total < 3) continue;
        const [dominant, dominantInfo] = entries[0];
        const minority = entries.slice(1);
        const minorityTotal = minority.reduce((sum, [, v]) => sum + v.count, 0);
        // Only report when one form clearly dominates; an even split is usually
        // two different words rather than an inconsistency.
        if (dominantInfo.count < minorityTotal * 2) continue;
        findings.push({
          start: minority[0][1].start,
          end: minority[0][1].end,
          message: `Capitalised inconsistently: "${dominant}" (${dominantInfo.count}×) vs ${minority.map(([f, v]) => `"${f}" (${v.count}×)`).join(', ')}.`,
          suggestion: dominant,
          aggregate: true,
          occurrences: minorityTotal,
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'terminology/first-person',
    title: 'First-person voice against house style',
    category: 'Tone',
    severity: 'minor',
    check(doc, ctx) {
      const policy = ctx.config.houseStyle.firstPerson; // 'allow' | 'forbid' | 'auto'
      const firstPerson = [...doc.scan(/\b(?:we|our|us|I|my)\b/g, { types: ['paragraph', 'listItem'] })];
      const org = ctx.config.organisation;
      const thirdPerson = org
        ? [...doc.scan(new RegExp(`\\b${org.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(?:recommends?|assessed|observed|found|notes?)`, 'g'), { types: ['paragraph', 'listItem'] })]
        : [];

      if (policy === 'forbid' && firstPerson.length) {
        return [{
          start: firstPerson[0].start,
          end: firstPerson[0].end,
          message: `House style is third person, but first-person pronouns appear ${firstPerson.length} time${firstPerson.length === 1 ? '' : 's'}.`,
          suggestion: org ? `"${org} recommends..." rather than "we recommend..."` : 'Rewrite in the third person.',
          aggregate: true,
          occurrences: firstPerson.length,
        }];
      }
      if (policy === 'auto' && firstPerson.length && thirdPerson.length) {
        return [{
          start: firstPerson[0].start,
          end: firstPerson[0].end,
          message: `The report mixes first person (${firstPerson.length}×) and third person (${thirdPerson.length}×) when referring to the assessor. Pick one voice.`,
          aggregate: true,
          occurrences: firstPerson.length,
        }];
      }
      return [];
    },
  },
];

/** Do the words either side of an acronym plausibly spell it out? */
function looksLikeExpansion(acronym, before, after) {
  const candidate = (/\(\s*$/.test(before) ? before.slice(0, -1) : after.replace(/^\s*\(/, '').split(')')[0]);
  const words = candidate.trim().split(/[\s-]+/).filter(Boolean).slice(-acronym.length * 2);
  if (words.length < 2) return false;
  const initials = words.map((w) => w[0]).join('').toUpperCase();
  const letters = acronym.toUpperCase();
  // Allow for dropped "of"/"and" by checking the acronym's letters appear in order.
  let index = 0;
  for (const letter of letters) {
    index = initials.indexOf(letter, index);
    if (index === -1) return false;
    index += 1;
  }
  return true;
}
