/**
 * Whitespace and spacing rules.
 *
 * These are the checks a reader notices without being able to name: a stray
 * double space, a paragraph that sits three blank lines below its heading, a
 * no-break space pasted in from a vendor portal that stops a line wrapping.
 */

import { INVISIBLES } from '../text.mjs';

const PROSE = ['paragraph', 'listItem', 'heading', 'caption'];

export const rules = [
  {
    id: 'whitespace/double-space',
    title: 'Multiple consecutive spaces',
    category: 'Spacing',
    severity: 'minor',
    fixable: true,
    check(doc, ctx) {
      const findings = [];
      const allowTwoAfterSentence = ctx.config.houseStyle.sentenceSpacing === 2;
      for (const { match, start, end, block } of doc.scan(/ {2,}/g, { types: PROSE })) {
        // Leading indentation on a continuation line is not a double space.
        if (/^\s*$/.test(block.text.slice(0, match.index))) continue;
        const before = block.text[match.index - 1];
        if (allowTwoAfterSentence && match[0].length === 2 && /[.!?]/.test(before || '')) continue;
        findings.push({
          start,
          end,
          message: `${match[0].length} consecutive spaces.`,
          suggestion: ' ',
          fix: ' ',
        });
      }
      return findings;
    },
  },

  {
    id: 'whitespace/inconsistent-sentence-spacing',
    title: 'Mixed one-space and two-space sentence separation',
    category: 'Spacing',
    severity: 'minor',
    check(doc) {
      let single = 0;
      let double = 0;
      const doubles = [];
      for (const { match, start, end } of doc.scan(/[.!?](?<!\.\.\.)( {1,2})(?=[A-Z"'(“‘])/g, { types: PROSE })) {
        if (match[1].length === 2) { double += 1; doubles.push({ start, end }); }
        else single += 1;
      }
      if (single === 0 || double === 0) return [];
      const minority = single < double ? 'single' : 'double';
      return [{
        start: doubles[0].start,
        end: doubles[0].end,
        message: `Sentence separation is inconsistent: ${single} single-space and ${double} double-space breaks. Pick one (modern practice is a single space) and apply it throughout.`,
        note: `The ${minority}-space form is the minority here.`,
        aggregate: true,
      }];
    },
  },

  {
    id: 'whitespace/trailing',
    title: 'Trailing whitespace at end of line',
    category: 'Spacing',
    severity: 'nit',
    fixable: true,
    check(doc) {
      if (doc.format === 'docx') return [];
      const findings = [];
      let offset = 0;
      for (const line of doc.lines) {
        const trailing = line.match(/[ \t]+$/);
        if (trailing && line.trim()) {
          findings.push({
            start: offset + trailing.index,
            end: offset + line.length,
            message: `Trailing whitespace (${trailing[0].length} character${trailing[0].length === 1 ? '' : 's'}).`,
            note: trailing[0] === '  ' ? 'Two trailing spaces are a Markdown hard line break - remove only if that was not intended.' : undefined,
            fix: '',
          });
        }
        offset += line.length + 1;
      }
      return findings;
    },
  },

  {
    id: 'whitespace/excess-blank-lines',
    title: 'Excessive vertical white space',
    category: 'Spacing',
    severity: 'minor',
    fixable: true,
    check(doc, ctx) {
      const limit = ctx.config.houseStyle.maxConsecutiveBlankLines ?? 1;
      if (doc.format === 'docx') return blankParagraphRuns(doc, limit);
      const findings = [];
      const pattern = new RegExp(`\\n[ \\t]*(?:\\n[ \\t]*){${limit + 1},}`, 'g');
      let match;
      while ((match = pattern.exec(doc.text)) !== null) {
        const blanks = (match[0].match(/\n/g) || []).length - 1;
        findings.push({
          start: match.index,
          end: match.index + match[0].length,
          message: `${blanks} consecutive blank lines (house style allows ${limit}).`,
          suggestion: `${limit} blank line${limit === 1 ? '' : 's'}`,
          fix: '\n' + '\n'.repeat(limit),
        });
      }
      return findings;
    },
  },

  {
    id: 'whitespace/invisible-characters',
    title: 'Invisible or non-standard space characters',
    category: 'Spacing',
    severity: 'minor',
    fixable: true,
    check(doc) {
      const findings = [];
      const chars = Object.keys(INVISIBLES).join('');
      const pattern = new RegExp(`[${chars}]+`, 'g');
      let match;
      while ((match = pattern.exec(doc.text)) !== null) {
        const kinds = [...new Set([...match[0]].map((c) => INVISIBLES[c].name))];
        findings.push({
          start: match.index,
          end: match.index + match[0].length,
          message: `Contains ${kinds.join(', ')} - usually pasted in from Word, a browser or a vendor portal.`,
          note: 'These break search, wrapping and diffing without being visible on the page.',
          fix: [...match[0]].map((c) => INVISIBLES[c].replacement).join(''),
        });
      }
      return findings;
    },
  },

  {
    id: 'whitespace/tab-in-prose',
    title: 'Tab character inside prose',
    category: 'Spacing',
    severity: 'nit',
    check(doc) {
      const findings = [];
      for (const { start, end, block } of doc.scan(/\t+/g, { types: ['paragraph', 'heading', 'caption'] })) {
        findings.push({
          start,
          end,
          message: 'Tab character inside a paragraph. Use paragraph styles or indentation settings rather than tabs.',
          note: block.type === 'heading' ? 'Tabs in a heading usually mean manual numbering that should come from the heading style.' : undefined,
        });
      }
      return findings;
    },
  },

  {
    id: 'whitespace/space-before-punctuation',
    title: 'Space before punctuation',
    category: 'Spacing',
    severity: 'minor',
    fixable: true,
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/[ \u00A0]+([,;:.!?%)\]])/g, { types: PROSE })) {
        // "10 %" is a legitimate style choice; everything else is a slip.
        if (match[1] === '%' ) continue;
        findings.push({
          start,
          end,
          message: `Space before "${match[1]}".`,
          suggestion: match[1],
          fix: match[1],
        });
      }
      return findings;
    },
  },

  {
    id: 'whitespace/missing-space-after-punctuation',
    title: 'Missing space after punctuation',
    category: 'Spacing',
    severity: 'major',
    fixable: true,
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/([,;:])(?=[A-Za-z])|([.!?])(?=[A-Z][a-z])/g, { types: PROSE })) {
        const mark = match[1] || match[2];
        findings.push({
          start,
          end,
          message: `No space after "${mark}".`,
          suggestion: `${mark} `,
          fix: `${mark} `,
        });
      }
      return findings;
    },
  },

  {
    id: 'whitespace/space-inside-brackets',
    title: 'Space just inside brackets',
    category: 'Spacing',
    severity: 'nit',
    fixable: true,
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/\(\s+|\s+\)|\[\s+|\s+\]/g, { types: PROSE })) {
        findings.push({
          start,
          end,
          message: 'Space immediately inside a bracket.',
          suggestion: match[0].trim(),
          fix: match[0].trim(),
        });
      }
      return findings;
    },
  },

  {
    id: 'whitespace/empty-item',
    title: 'Empty list item or table cell',
    category: 'Spacing',
    severity: 'minor',
    check(doc) {
      const findings = [];
      for (const block of doc.blocks) {
        if (block.type === 'listItem' && !block.text.trim()) {
          findings.push({ start: block.start, end: block.end, message: 'Empty bullet point.' });
        }
        if (block.type === 'tableRow' && block.cells) {
          const empty = block.cells.filter((c) => !c.trim()).length;
          if (empty && empty < block.cells.length) {
            findings.push({
              start: block.start,
              end: block.end,
              message: `Table row has ${empty} empty cell${empty === 1 ? '' : 's'}. Use an explicit "N/A" or "None" so the gap reads as deliberate.`,
            });
          }
        }
      }
      return findings;
    },
  },

  {
    id: 'whitespace/heading-spacing',
    title: 'Heading not separated from surrounding text',
    category: 'Spacing',
    severity: 'nit',
    check(doc) {
      if (doc.format === 'docx') return [];
      const findings = [];
      for (const heading of doc.headings()) {
        const lineAbove = doc.lines[heading.line - 2];
        if (heading.line > 1 && lineAbove !== undefined && lineAbove.trim() !== '') {
          findings.push({
            start: heading.start,
            end: heading.end,
            message: 'No blank line before this heading.',
          });
        }
      }
      return findings;
    },
  },
];

/** In DOCX, runs of empty paragraphs are the equivalent of stacked blank lines. */
function blankParagraphRuns(doc, limit) {
  const findings = [];
  let run = [];
  const flush = () => {
    if (run.length > limit) {
      findings.push({
        start: run[0].start,
        end: run[run.length - 1].end,
        message: `${run.length} empty paragraphs in a row. Set space-before/space-after on the paragraph style instead of pressing Enter.`,
      });
    }
    run = [];
  };
  for (const block of doc.blocks) {
    if (block.type === 'blank') run.push(block);
    else flush();
  }
  flush();
  return findings;
}
