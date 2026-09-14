/**
 * Document structure: heading hierarchy, section completeness, cross-references,
 * numbering sequences and the copy-paste artefacts that survive redrafting.
 */

import { PLACEHOLDERS } from '../data/terms.mjs';

const SCOPE = ['paragraph', 'listItem', 'heading', 'caption', 'tableRow', 'notes'];

export const rules = [
  {
    id: 'structure/heading-level-skip',
    title: 'Heading level skipped',
    category: 'Structure',
    severity: 'minor',
    check(doc) {
      const findings = [];
      const headings = doc.headings();
      let previous = null;
      for (const heading of headings) {
        if (previous && heading.level > previous.level + 1) {
          findings.push({
            start: heading.start,
            end: heading.end,
            message: `Heading jumps from level ${previous.level} to level ${heading.level}, skipping level ${previous.level + 1}.`,
            note: 'Skipped levels break the table of contents and assistive-technology navigation.',
          });
        }
        previous = heading;
      }
      return findings;
    },
  },

  {
    id: 'structure/duplicate-heading',
    title: 'Duplicate heading text',
    category: 'Structure',
    severity: 'minor',
    check(doc) {
      const seen = new Map();
      const findings = [];
      for (const heading of doc.headings()) {
        const key = heading.text.trim().toLowerCase().replace(/^[\d.\s]+/, '');
        if (!key) continue;
        if (seen.has(key)) {
          findings.push({
            start: heading.start,
            end: heading.end,
            message: `Heading "${heading.text.trim()}" repeats the one at line ${seen.get(key)}.`,
            note: 'Identical headings make cross-references ambiguous.',
          });
        } else seen.set(key, heading.line);
      }
      return findings;
    },
  },

  {
    id: 'structure/empty-section',
    title: 'Section has no content',
    category: 'Structure',
    severity: 'major',
    check(doc) {
      const findings = [];
      const headings = doc.headings();
      for (let i = 0; i < headings.length; i += 1) {
        const heading = headings[i];
        const next = headings[i + 1];
        const content = doc.blocks.filter((b) => (
          b.start > heading.end
          && (!next || b.start < next.start)
          && b.type !== 'heading'
          && b.type !== 'blank'
          && b.text.trim()
        ));
        // A heading immediately followed by a deeper heading is a container,
        // not an empty section - and neither is the document's own title.
        const isDocumentTitle = /^(?:Title|Subtitle)$/i.test(heading.style || '') || (i === 0 && heading.level === 1 && next);
        if (!content.length && !isDocumentTitle && (!next || next.level <= heading.level)) {
          findings.push({
            start: heading.start,
            end: heading.end,
            message: `Section "${heading.text.trim()}" has no content.`,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'structure/heading-case',
    title: 'Inconsistent heading capitalisation',
    category: 'Structure',
    severity: 'minor',
    check(doc, ctx) {
      const headings = doc.headings().filter((h) => h.text.trim().split(/\s+/).length >= 3);
      if (headings.length < 3) return [];
      const classified = headings.map((h) => ({ heading: h, style: headingCase(h.text) })).filter((h) => h.style);
      const titleCase = classified.filter((h) => h.style === 'title');
      const sentenceCase = classified.filter((h) => h.style === 'sentence');
      if (!titleCase.length || !sentenceCase.length) return [];

      const preference = ctx.config.houseStyle.headingCase; // 'title' | 'sentence' | 'auto'
      const target = preference === 'auto'
        ? (titleCase.length >= sentenceCase.length ? 'title' : 'sentence')
        : preference;
      const offenders = target === 'title' ? sentenceCase : titleCase;
      if (!offenders.length) return [];
      return [{
        start: offenders[0].heading.start,
        end: offenders[0].heading.end,
        message: `Headings mix Title Case (${titleCase.length}) and Sentence case (${sentenceCase.length}). House style is ${target === 'title' ? 'Title Case' : 'Sentence case'}.`,
        note: `First inconsistent heading: "${offenders[0].heading.text.trim()}".`,
        aggregate: true,
        occurrences: offenders.length,
      }];
    },
  },

  {
    id: 'structure/required-section-missing',
    title: 'Required section is missing',
    category: 'Structure',
    severity: 'major',
    check(doc, ctx) {
      const required = ctx.config.requiredSections || [];
      if (!required.length) return [];
      const headings = doc.headings().map((h) => h.text.toLowerCase());
      const missing = required.filter((section) => {
        const needles = Array.isArray(section) ? section : [section];
        return !needles.some((needle) => headings.some((h) => h.includes(needle.toLowerCase())));
      });
      if (!missing.length) return [];
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: `The draft has no ${doc.format === 'pptx' ? 'slide titled' : 'section matching'}: ${missing.map((m) => `"${Array.isArray(m) ? m[0] : m}"`).join(', ')}.`,
        note: 'Configured in report-qa.config.json under requiredSections.',
        documentLevel: true,
      }];
    },
  },

  {
    id: 'structure/cross-reference',
    title: 'Cross-reference does not resolve',
    category: 'Structure',
    severity: 'major',
    check(doc) {
      const findings = [];
      const headingText = doc.headings().map((h) => h.text.toLowerCase()).join('\n');
      const captions = doc.blocks.filter((b) => b.type === 'caption').map((b) => b.text.toLowerCase());
      const body = doc.text.toLowerCase();

      const pattern = /\b(section|appendix|annex|figure|fig\.|table|exhibit|chapter|part)\s+([A-Z]|\d+(?:\.\d+)*)\b/gi;
      for (const { match, start, end } of doc.scan(pattern, { types: SCOPE })) {
        const kind = match[1].toLowerCase().replace('fig.', 'figure');
        const id = match[2];
        let resolved = false;

        if (kind === 'figure' || kind === 'table' || kind === 'exhibit') {
          const label = new RegExp(`\\b${kind}\\s*${escape(id)}\\b[.:)\\s]`, 'i');
          resolved = captions.some((c) => label.test(c));
        } else {
          const numbered = new RegExp(`(?:^|\\n)\\s*${escape(id)}[.\\s)]`, 'm');
          resolved = numbered.test(headingText)
            || new RegExp(`\\b${kind}\\s+${escape(id)}\\b[^,;)]*(?:\\n|$)`, 'i').test(headingText)
            || (kind === 'appendix' || kind === 'annex'
              ? new RegExp(`\\b(?:appendix|annex)\\s+${escape(id)}\\b`, 'i').test(headingText)
              : false);
        }

        if (resolved) continue;
        // Do not report when the target simply is not numbered in a way we can see.
        const mentionedElsewhere = (body.match(new RegExp(`\\b${kind}\\s+${escape(id)}\\b`, 'gi')) || []).length;
        findings.push({
          start,
          end,
          message: `"${match[0]}" has no matching ${kind === 'section' ? 'heading' : kind} in the draft.`,
          note: mentionedElsewhere > 1 ? `Referenced ${mentionedElsewhere} times; the target may not have been written yet.` : undefined,
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'structure/caption-sequence',
    title: 'Figure or table numbering is not sequential',
    category: 'Structure',
    severity: 'minor',
    check(doc) {
      const findings = [];
      const series = new Map();
      for (const block of doc.blocks) {
        if (block.type !== 'caption') continue;
        const match = block.text.match(/^\s*(figure|fig\.|table|exhibit|chart|diagram)\s*(\d+)/i);
        if (!match) continue;
        const kind = match[1].toLowerCase().replace('fig.', 'figure');
        if (!series.has(kind)) series.set(kind, []);
        series.get(kind).push({ number: Number(match[2]), block });
      }
      for (const [kind, items] of series) {
        let expected = 1;
        const seen = new Set();
        for (const item of items) {
          if (seen.has(item.number)) {
            findings.push({
              start: item.block.start,
              end: item.block.end,
              message: `${titleCaseWord(kind)} ${item.number} is used twice.`,
            });
          } else if (item.number !== expected) {
            findings.push({
              start: item.block.start,
              end: item.block.end,
              message: `${titleCaseWord(kind)} numbering jumps to ${item.number}; expected ${expected}.`,
            });
          }
          seen.add(item.number);
          expected = Math.max(expected, item.number) + 1;
        }
      }
      return findings;
    },
  },

  {
    id: 'structure/duplicate-paragraph',
    title: 'Repeated sentence or paragraph',
    category: 'Structure',
    severity: 'major',
    check(doc) {
      const findings = [];
      const seen = new Map();
      for (const sentence of doc.sentences()) {
        const key = sentence.text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
        if (key.length < 60) continue;
        if (seen.has(key)) {
          findings.push({
            start: sentence.start,
            end: sentence.end,
            message: `This sentence already appears at line ${doc.position(seen.get(key)).line}.`,
            note: 'Usually a copy-paste artefact from redrafting.',
          });
        } else seen.set(key, sentence.start);
      }
      return findings;
    },
  },

  {
    id: 'structure/single-item-list',
    title: 'List with only one item',
    category: 'Structure',
    severity: 'nit',
    check(doc) {
      const findings = [];
      const items = doc.blocks.filter((b) => b.type === 'listItem');
      let group = [];
      let lastLine = -10;
      const flush = () => {
        if (group.length === 1) {
          findings.push({
            start: group[0].start,
            end: group[0].end,
            message: 'A list with a single bullet - fold it into the preceding paragraph or add the missing items.',
          });
        }
        group = [];
      };
      for (const item of items) {
        if (item.line - lastLine > 2) flush();
        group.push(item);
        lastLine = item.line;
      }
      flush();
      return findings;
    },
  },

  {
    id: 'structure/list-marker-consistency',
    title: 'Mixed bullet markers',
    category: 'Structure',
    severity: 'nit',
    check(doc) {
      if (doc.format === 'docx') return [];
      const markers = new Map();
      for (const block of doc.blocks) {
        if (block.type !== 'listItem' || block.ordered) continue;
        if (!markers.has(block.marker)) markers.set(block.marker, { count: 0, block });
        markers.get(block.marker).count += 1;
      }
      if (markers.size < 2) return [];
      const entries = [...markers.entries()].sort((a, b) => b[1].count - a[1].count);
      return [{
        start: entries[1][1].block.start,
        end: entries[1][1].block.end,
        message: `Bullet markers are mixed: ${entries.map(([m, v]) => `"${m}" (${v.count})`).join(', ')}. Use one marker throughout.`,
        aggregate: true,
      }];
    },
  },

  {
    id: 'structure/placeholder-text',
    title: 'Unfinished placeholder text',
    category: 'Completeness',
    severity: 'blocker',
    check(doc) {
      const findings = [];
      for (const entry of PLACEHOLDERS) {
        for (const { match, start, end } of doc.scan(entry.pattern, { types: SCOPE })) {
          findings.push({
            start,
            end,
            message: `${entry.label}: "${match[0].trim()}".`,
            severity: entry.severity || 'blocker',
            note: 'This must not reach a client.',
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'structure/bare-url',
    title: 'Bare or insecure URL',
    category: 'Structure',
    severity: 'minor',
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/\bhttps?:\/\/[^\s<>()[\]{}"']+/gi, { types: SCOPE, skipOpaque: false })) {
        const url = match[0];
        if (/\[\.\]|hxxp/i.test(url)) continue;
        if (/^http:\/\//i.test(url) && !/localhost|127\.0\.0\.1/.test(url)) {
          findings.push({
            start,
            end,
            message: `Insecure http:// link: ${truncate(url)}`,
            suggestion: url.replace(/^http:/i, 'https:'),
          });
        }
        if (/localhost|127\.0\.0\.1|:\d{4,5}\b/.test(url)) {
          findings.push({
            start,
            end,
            message: `Link points at a local or non-standard-port address and will not work for the reader: ${truncate(url)}`,
            severity: 'major',
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'structure/table-column-mismatch',
    title: 'Table rows have different column counts',
    category: 'Structure',
    severity: 'major',
    check(doc) {
      const findings = [];
      let group = [];
      let lastLine = -10;
      const flush = () => {
        if (group.length >= 2) {
          const widths = group.map((r) => r.cells.length);
          const expected = widths[0];
          group.forEach((row, i) => {
            if (widths[i] !== expected) {
              findings.push({
                start: row.start,
                end: row.end,
                message: `Table row has ${widths[i]} cells; the first row has ${expected}.`,
              });
            }
          });
        }
        group = [];
      };
      for (const block of doc.blocks) {
        if (block.type !== 'tableRow' || !block.cells) { flush(); continue; }
        if (block.line - lastLine > 2) flush();
        group.push(block);
        lastLine = block.line;
      }
      flush();
      return findings;
    },
  },
];

/** Classify a heading as Title Case or Sentence case, or null when ambiguous. */
function headingCase(text) {
  const clean = text.trim().replace(/^[\d.]+\s*/, '');
  const words = clean.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 3) return null;
  const minor = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'is', 'vs']);
  const significant = words.slice(1).filter((w) => !minor.has(w.toLowerCase()) && /^[A-Za-z]/.test(w));
  if (!significant.length) return null;
  // Acronyms and product names are capitalised in both styles, so ignore them.
  const candidates = significant.filter((w) => !/^[A-Z]{2,}$/.test(w) && !/[A-Z]/.test(w.slice(1)));
  if (candidates.length < 2) return null;
  const capitalised = candidates.filter((w) => /^[A-Z]/.test(w)).length;
  if (capitalised === candidates.length) return 'title';
  if (capitalised === 0) return 'sentence';
  return null;
}

function titleCaseWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function escape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(value, length = 60) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
