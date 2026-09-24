/**
 * Punctuation and typography rules.
 *
 * Most of these are consistency checks rather than correctness checks: a report
 * may use straight quotes or curly quotes, spaced en dashes or closed em
 * dashes, Oxford commas or not - but it has to pick one and hold it, and a
 * draft assembled from several authors almost never does.
 */

import { LOWERCASE_NAMES } from '../data/terms.mjs';
import { splitSentences } from '../text.mjs';

const PROSE = ['paragraph', 'listItem', 'caption'];
const PROSE_AND_HEADINGS = [...PROSE, 'heading', 'tableRow'];

export const rules = [
  {
    id: 'punctuation/quote-style',
    title: 'Mixed straight and curly quotation marks',
    category: 'Typography',
    severity: 'minor',
    check(doc, ctx) {
      const preferred = ctx.config.houseStyle.quotes; // 'curly' | 'straight' | 'auto'
      const curly = [...doc.scan(/[‘’“”]/g, { types: PROSE_AND_HEADINGS })];
      const straight = [...doc.scan(/["']/g, { types: PROSE_AND_HEADINGS })];
      if (!curly.length && !straight.length) return [];

      let target = preferred;
      if (target === 'auto') target = curly.length >= straight.length ? 'curly' : 'straight';
      const offenders = target === 'curly' ? straight : curly;
      if (!offenders.length) return [];
      // Only worth reporting as a mix; a report that is uniformly straight-quoted is fine.
      const other = target === 'curly' ? curly : straight;
      if (!other.length && preferred === 'auto') return [];

      return [{
        start: offenders[0].start,
        end: offenders[0].end,
        message: `Mixed quotation mark styles: ${curly.length} curly and ${straight.length} straight. House style is ${target}.`,
        note: `First of ${offenders.length} inconsistent mark${offenders.length === 1 ? '' : 's'}. Usually caused by pasting between Word and a plain-text editor.`,
        aggregate: true,
        occurrences: offenders.length,
      }];
    },
  },

  {
    id: 'punctuation/apostrophe-plural',
    title: 'Apostrophe used to form a plural',
    category: 'Punctuation',
    severity: 'major',
    fixable: true,
    check(doc) {
      const findings = [];
      // A verb after the apostrophe means the token is the sentence's subject,
      // so the "s" was pluralising, not possessing: "Three CVE's were found".
      const VERB_AFTER = /^\s+(?:is|are|was|were|have|has|had|will|would|can|could|should|must|remain|remained|include|included|exist|existed|appear|appeared|affect|affected|range|ranged|also|both|then)\b/i;
      // CVE's, VPN's, 1990's, PC's - none of these are possessives in report prose.
      for (const { match, start, end, block } of doc.scan(/\b([A-Z]{2,}|\d{4}|[A-Z][a-z]*[A-Z])['’](s)\b/g, { types: PROSE_AND_HEADINGS })) {
        const after = block.text.slice(match.index + match[0].length, match.index + match[0].length + 30);
        const before = block.text.slice(Math.max(0, match.index - 24), match.index);
        const counted = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|many|multiple|numerous|all|both|these|those)\s+$/i.test(before);
        const decade = /^\d{4}$/.test(match[1]);
        // A genuine possessive is followed by a noun: "NIST's guidance".
        if (!counted && !decade && !VERB_AFTER.test(after) && /^\s+[a-z]/.test(after)) continue;
        findings.push({
          start,
          end,
          message: `"${match[0]}" uses an apostrophe to form a plural.`,
          suggestion: `${match[1]}s`,
          fix: `${match[1]}s`,
          note: 'Apostrophes mark possession or omission, never plurality.',
        });
      }
      return findings;
    },
  },

  {
    id: 'punctuation/dash-style',
    title: 'Hyphen used where a dash belongs',
    category: 'Typography',
    severity: 'minor',
    fixable: true,
    check(doc, ctx) {
      const findings = [];
      const style = ctx.config.houseStyle.dashStyle; // 'spaced-en' | 'closed-em' | 'spaced-em'
      const replacement = style === 'closed-em' ? '—' : style === 'spaced-em' ? ' — ' : ' – ';
      const label = style === 'closed-em' ? 'closed em dash (word—word)'
        : style === 'spaced-em' ? 'spaced em dash (word — word)'
          : 'spaced en dash (word – word)';

      // A hyphen surrounded by spaces is standing in for a dash.
      for (const { start, end } of doc.scan(/(?<=\S)\s+-{1,2}\s+(?=\S)/g, { types: PROSE_AND_HEADINGS })) {
        findings.push({
          start,
          end,
          message: `Hyphen used as a parenthetical dash. House style is a ${label}.`,
          suggestion: replacement.trim() === '—' && style === 'closed-em' ? 'word—word' : replacement,
          fix: replacement,
        });
      }

      // A written-out date is not a range, and an advisory report is full of
      // them - every ISO date would otherwise be reported twice, once for
      // year-month and once for month-day.
      const dates = [...doc.text.matchAll(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}-\d{1,2}-\d{4}\b/g)]
        .map((m) => [m.index, m.index + m[0].length]);
      const insideDate = (from, to) => dates.some(([s, e]) => from >= s && to <= e);

      // Number ranges take an en dash, not a hyphen.
      for (const { match, start, end } of doc.scan(/(\d)\s?-\s?(\d)/g, { types: PROSE_AND_HEADINGS })) {
        if (insideDate(start, end)) continue;
        findings.push({
          start,
          end,
          message: 'Numeric range uses a hyphen; ranges take an en dash.',
          suggestion: `${match[1]}–${match[2]}`,
          fix: `${match[1]}–${match[2]}`,
          note: 'Skip this if the value is an identifier or part number rather than a range.',
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'punctuation/dash-consistency',
    title: 'Mixed dash conventions',
    category: 'Typography',
    severity: 'minor',
    check(doc) {
      const spacedEn = [...doc.scan(/\s–\s/g, { types: PROSE_AND_HEADINGS })].length;
      const closedEm = [...doc.scan(/\S—\S/g, { types: PROSE_AND_HEADINGS })].length;
      const spacedEm = [...doc.scan(/\s—\s/g, { types: PROSE_AND_HEADINGS })].length;
      const used = [
        ['spaced en dash', spacedEn],
        ['closed em dash', closedEm],
        ['spaced em dash', spacedEm],
      ].filter(([, n]) => n > 0);
      if (used.length < 2) return [];
      const summary = used.map(([name, n]) => `${n} ${name}${n === 1 ? '' : 'es'}`).join(', ');
      const first = [...doc.scan(/\s[–—]\s|\S—\S/g, { types: PROSE_AND_HEADINGS })][0];
      return [{
        start: first.start,
        end: first.end,
        message: `The draft mixes dash conventions: ${summary}. Pick one.`,
        aggregate: true,
      }];
    },
  },

  {
    id: 'punctuation/ellipsis',
    title: 'Three full stops instead of an ellipsis',
    category: 'Typography',
    severity: 'nit',
    fixable: true,
    check(doc) {
      return [...doc.scan(/\.{3,}/g, { types: PROSE })].map(({ start, end }) => ({
        start,
        end,
        message: 'Use a single ellipsis character rather than full stops.',
        suggestion: '…',
        fix: '…',
      }));
    },
  },

  {
    id: 'punctuation/repeated',
    title: 'Repeated or stacked punctuation',
    category: 'Punctuation',
    severity: 'major',
    fixable: true,
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/([,;:])\1+|,\.|\.,|\?\.|!\.|;;|::|\.{2}(?!\.)/g, { types: PROSE_AND_HEADINGS })) {
        const keep = match[0][0];
        findings.push({
          start,
          end,
          message: `Stacked punctuation "${match[0]}".`,
          suggestion: keep,
          fix: keep,
        });
      }
      return findings;
    },
  },

  {
    id: 'punctuation/unbalanced-delimiters',
    title: 'Unbalanced brackets or quotation marks',
    category: 'Punctuation',
    severity: 'major',
    check(doc) {
      const findings = [];
      for (const block of doc.blocks) {
        if (block.type === 'code') continue;
        const stack = [];
        const pairs = { '(': ')', '[': ']', '{': '}' };
        const closers = { ')': '(', ']': '[', '}': '{' };
        for (let i = 0; i < block.text.length; i += 1) {
          const ch = block.text[i];
          if (pairs[ch]) stack.push({ ch, i });
          else if (closers[ch]) {
            if (!stack.length || stack[stack.length - 1].ch !== closers[ch]) {
              findings.push({
                start: block.start + i,
                end: block.start + i + 1,
                message: `Closing "${ch}" with no matching opening bracket.`,
              });
            } else stack.pop();
          }
        }
        for (const open of stack) {
          findings.push({
            start: block.start + open.i,
            end: block.start + open.i + 1,
            message: `Opening "${open.ch}" is never closed in this paragraph.`,
          });
        }
        // Curly quotes should pair up within a paragraph.
        const openDouble = (block.text.match(/“/g) || []).length;
        const closeDouble = (block.text.match(/”/g) || []).length;
        if (openDouble !== closeDouble) {
          findings.push({
            start: block.start,
            end: block.end,
            message: `Unbalanced curly double quotes in this paragraph (${openDouble} opening, ${closeDouble} closing).`,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'punctuation/oxford-comma',
    title: 'Inconsistent serial (Oxford) comma',
    category: 'Punctuation',
    severity: 'minor',
    check(doc, ctx) {
      const preference = ctx.config.houseStyle.oxfordComma; // true | false | 'auto'
      const withComma = [];
      const withoutComma = [];
      for (const sentence of doc.sentences()) {
        const text = sentence.text;
        if (!/,/.test(text)) continue;
        if (/,\s+(?:and|or)\s+\S/.test(text)) {
          withComma.push(sentence);
        } else if (/\w,\s+[^,]{2,60}?\s+(?:and|or)\s+\w/.test(text)) {
          withoutComma.push(sentence);
        }
      }
      if (!withComma.length || !withoutComma.length) {
        if (preference === true && withoutComma.length && !withComma.length) {
          return [{
            start: withoutComma[0].start,
            end: withoutComma[0].end,
            message: `House style uses the Oxford comma, but ${withoutComma.length} list${withoutComma.length === 1 ? '' : 's'} omit it.`,
            aggregate: true,
          }];
        }
        if (preference === false && withComma.length && !withoutComma.length) {
          return [{
            start: withComma[0].start,
            end: withComma[0].end,
            message: `House style omits the Oxford comma, but ${withComma.length} list${withComma.length === 1 ? '' : 's'} use it.`,
            aggregate: true,
          }];
        }
        return [];
      }
      const target = preference === 'auto'
        ? (withComma.length >= withoutComma.length ? 'with' : 'without')
        : (preference ? 'with' : 'without');
      const offenders = target === 'with' ? withoutComma : withComma;
      return [{
        start: offenders[0].start,
        end: offenders[0].end,
        message: `Serial comma is used inconsistently: ${withComma.length} list${withComma.length === 1 ? '' : 's'} with it, ${withoutComma.length} without. House style is ${target === 'with' ? 'to use it' : 'to omit it'}.`,
        aggregate: true,
        occurrences: offenders.length,
      }];
    },
  },

  {
    id: 'punctuation/bullet-terminators',
    title: 'Inconsistent punctuation at the end of bullets',
    category: 'Punctuation',
    severity: 'minor',
    check(doc, ctx) {
      const items = doc.blocks.filter((b) => b.type === 'listItem' && b.text.trim());
      if (items.length < 2) return [];
      const preference = ctx.config.houseStyle.bulletTerminalPunctuation; // 'period' | 'none' | 'auto'
      const findings = [];

      // Group adjacent list items so each list is judged on its own terms.
      const groups = [];
      let current = [];
      let lastLine = -10;
      for (const item of items) {
        if (item.line - lastLine > 2 && current.length) { groups.push(current); current = []; }
        current.push(item);
        lastLine = item.line;
      }
      if (current.length) groups.push(current);

      for (const group of groups) {
        if (group.length < 3) continue;
        const ended = group.filter((b) => /[.!?]$/.test(b.text.trim()));
        const bare = group.filter((b) => !/[.!?:;]$/.test(b.text.trim()));
        if (!ended.length || !bare.length) continue;
        const target = preference === 'auto' ? (ended.length >= bare.length ? 'period' : 'none') : preference;
        const offenders = target === 'period' ? bare : ended;
        if (!offenders.length) continue;
        findings.push({
          start: offenders[0].start,
          end: offenders[0].end,
          message: `Within one list, ${ended.length} bullet${ended.length === 1 ? '' : 's'} end with a full stop and ${bare.length} do not. House style: ${target === 'period' ? 'end every bullet with a full stop' : 'no terminal punctuation on bullets'}.`,
          aggregate: true,
          occurrences: offenders.length,
        });
      }
      return findings;
    },
  },

  {
    id: 'punctuation/heading-terminator',
    title: 'Heading ends with a full stop',
    category: 'Punctuation',
    severity: 'nit',
    fixable: true,
    check(doc) {
      return doc.headings()
        .filter((h) => /\.$/.test(h.text.trim()) && !/\.\.\.$/.test(h.text.trim()))
        .map((h) => ({
          start: h.start + h.text.trimEnd().length - 1,
          end: h.start + h.text.trimEnd().length,
          message: 'Headings do not take a terminal full stop.',
          fix: '',
        }));
    },
  },

  {
    id: 'punctuation/quote-placement',
    title: 'Punctuation placement around closing quotes',
    category: 'Typography',
    severity: 'nit',
    check(doc, ctx) {
      const inside = [...doc.scan(/[,.](?=["”])/g, { types: PROSE })];
      const outside = [...doc.scan(/["”][,.]/g, { types: PROSE })];
      if (!inside.length || !outside.length) return [];
      const american = ctx.dialect === 'en-US';
      const expected = american ? 'inside' : 'outside';
      const offenders = american ? outside : inside;
      return [{
        start: offenders[0].start,
        end: offenders[0].end,
        message: `Commas and full stops sit inside closing quotes ${inside.length} time${inside.length === 1 ? '' : 's'} and outside ${outside.length} time${outside.length === 1 ? '' : 's'}. ${american ? 'US' : 'UK'} convention places them ${expected} the quotation marks.`,
        note: american ? undefined : 'UK "logical" punctuation keeps the mark outside unless it belongs to the quoted material.',
        aggregate: true,
      }];
    },
  },

  {
    id: 'punctuation/missing-terminator',
    title: 'Paragraph does not end with punctuation',
    category: 'Punctuation',
    severity: 'minor',
    check(doc) {
      const findings = [];
      for (const block of doc.blocks) {
        if (block.type !== 'paragraph') continue;
        const text = block.text.trim();
        if (!text || text.length < 25) continue;
        if (/[.!?:;)\]"”’]$/.test(text)) continue;
        if (/^\|/.test(text)) continue;
        findings.push({
          start: block.end - 1,
          end: block.end,
          message: 'Paragraph ends without terminal punctuation - check the sentence is complete.',
        });
      }
      return findings;
    },
  },

  {
    id: 'punctuation/comma-splice',
    title: 'Possible comma splice',
    category: 'Grammar',
    severity: 'minor',
    check(doc) {
      const findings = [];
      const adverbs = 'however|therefore|thus|hence|consequently|moreover|furthermore|nevertheless|nonetheless|otherwise|instead|additionally';
      const pattern = new RegExp(`\\w,\\s+(${adverbs})\\s*,?\\s+(?=(?:the|this|these|a|an|it|we|they|there|[A-Z]))`, 'gi');
      for (const { match, start, end } of doc.scan(pattern, { types: PROSE })) {
        findings.push({
          start,
          end,
          message: `"${match[1]}" joins two independent clauses with a comma.`,
          suggestion: `Use a semicolon or start a new sentence: "...; ${match[1].toLowerCase()}, ..."`,
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'punctuation/repeated-word',
    title: 'Word repeated',
    category: 'Grammar',
    severity: 'major',
    fixable: true,
    check(doc) {
      const findings = [];
      // "that that" and "had had" are occasionally correct; everything else is a slip.
      const legitimate = new Set(['that', 'had', 'is']);
      for (const { match, start, end } of doc.scan(/\b(\w+)(\s+)\1\b/gi, { types: PROSE_AND_HEADINGS })) {
        if (legitimate.has(match[1].toLowerCase())) continue;
        if (/^\d+$/.test(match[1])) continue;
        findings.push({
          start,
          end,
          message: `"${match[1]}" is repeated.`,
          suggestion: match[1],
          fix: match[1],
        });
      }
      return findings;
    },
  },

  {
    id: 'punctuation/lowercase-sentence-start',
    title: 'Sentence starts with a lower-case letter',
    category: 'Grammar',
    severity: 'major',
    note: 'Only sentences that follow another sentence in the same paragraph are '
      + 'checked. A paragraph that opens in lower case is usually a bullet, a cell '
      + 'or a slide text box rather than a mistake, and reporting those buried the '
      + 'real ones.',
    check(doc) {
      const findings = [];
      for (const block of doc.blocks) {
        if (block.type !== 'paragraph') continue;
        const sentences = splitSentences(block.text, block.start);
        for (let i = 0; i < sentences.length; i += 1) {
          // The first sentence of a paragraph is not evidence of anything. A
          // slide text box, a hand-typed bullet and a layout table's cell all
          // arrive as paragraphs, and all of them legitimately open mid-thought.
          // A sentence that follows a full stop in the same paragraph is the
          // case where a missing capital is genuinely a missing capital.
          if (i === 0) continue;
          const sentence = sentences[i];
          if (!/[a-z]/.test(sentence.text[0])) continue;
          // Product names and identifiers legitimately start lower case.
          const word = (sentence.text.match(/^\S+/) || [''])[0];
          if (/[A-Z0-9_/\\.-]/.test(word.slice(1))) continue;
          if (LOWERCASE_NAMES.has(word.replace(/[^A-Za-z-]/g, '').toLowerCase())) continue;
          if (doc.isOpaque(sentence.start)) continue;
          findings.push({
            start: sentence.start,
            end: sentence.start + word.length,
            message: `Sentence begins with a lower-case word ("${word}").`,
            confidence: 'medium',
          });
        }
      }
      return findings;
    },
  },
];
