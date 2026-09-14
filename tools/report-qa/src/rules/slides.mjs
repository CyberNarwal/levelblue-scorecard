/**
 * Slide-deck rules.
 *
 * These only fire on a .pptx. The failure modes in a deck are different from a
 * document: nobody reads a slide with ninety words on it, a slide with no title
 * cannot be navigated or referenced, and - the one that actually costs money -
 * speaker notes travel inside the file, so whatever the author wrote to
 * themselves is readable by the client.
 */

import { LAYOUT_PROMPTS } from '../extract/pptx.mjs';
import { escapeRegExp } from '../text.mjs';

const isDeck = (doc) => doc.format === 'pptx';

/** Offset of the first block on a slide, so a finding can point at it. */
function anchorFor(doc, slideNumber) {
  const block = doc.blocks.find((b) => b.slide === slideNumber);
  return block ? { start: block.start, end: block.end } : { start: 0, end: Math.min(1, doc.text.length) };
}

export const rules = [
  {
    id: 'slides/missing-title',
    title: 'Slide has no title',
    category: 'Slides',
    severity: 'minor',
    check(doc) {
      if (!isDeck(doc)) return [];
      return (doc.meta.slides || [])
        .filter((slide) => !slide.empty && !slide.title)
        .map((slide) => ({
          ...anchorFor(doc, slide.number),
          message: `Slide ${slide.number} has no title.`,
          note: 'Titles drive the contents page, the navigation pane and the story a reader skims.',
        }));
    },
  },

  {
    id: 'slides/text-density',
    title: 'Slide carries too much text',
    category: 'Slides',
    severity: 'minor',
    check(doc, ctx) {
      if (!isDeck(doc)) return [];
      const limit = ctx.config.slides.maxWordsPerSlide;
      return (doc.meta.slides || [])
        .filter((slide) => slide.words > limit)
        .map((slide) => ({
          ...anchorFor(doc, slide.number),
          message: `Slide ${slide.number} carries ${slide.words} words (house limit ${limit}).`,
          suggestion: 'Split it, or move the detail to the notes or an appendix.',
          severity: slide.words > limit * 1.75 ? 'major' : 'minor',
        }));
    },
  },

  {
    id: 'slides/bullet-count',
    title: 'Too many bullets on one slide',
    category: 'Slides',
    severity: 'nit',
    check(doc, ctx) {
      if (!isDeck(doc)) return [];
      const limit = ctx.config.slides.maxBulletsPerSlide;
      return (doc.meta.slides || [])
        .filter((slide) => slide.bullets > limit)
        .map((slide) => ({
          ...anchorFor(doc, slide.number),
          message: `Slide ${slide.number} has ${slide.bullets} bullets (house limit ${limit}).`,
        }));
    },
  },

  {
    id: 'slides/bullet-depth',
    title: 'Bullets nested too deeply',
    category: 'Slides',
    severity: 'nit',
    check(doc, ctx) {
      if (!isDeck(doc)) return [];
      const limit = ctx.config.slides.maxBulletDepth;
      return (doc.meta.slides || [])
        .filter((slide) => slide.maxDepth + 1 > limit)
        .map((slide) => ({
          ...anchorFor(doc, slide.number),
          message: `Slide ${slide.number} nests bullets ${slide.maxDepth + 1} levels deep (house limit ${limit}).`,
          suggestion: 'Past two levels the hierarchy stops being read as a hierarchy.',
        }));
    },
  },

  {
    id: 'slides/empty-slide',
    title: 'Slide has no content',
    category: 'Slides',
    severity: 'major',
    check(doc) {
      if (!isDeck(doc)) return [];
      return (doc.meta.slides || [])
        .filter((slide) => slide.empty)
        .map((slide) => ({
          start: 0,
          end: Math.min(1, doc.text.length),
          message: `Slide ${slide.number} has no text on it.`,
          note: 'If it is deliberately a section divider or an image-only slide, ignore this.',
          documentLevel: true,
          confidence: 'medium',
        }));
    },
  },

  {
    id: 'slides/layout-prompt-text',
    title: "PowerPoint's own placeholder text is still on a slide",
    category: 'Completeness',
    severity: 'blocker',
    check(doc) {
      if (!isDeck(doc)) return [];
      const findings = [];
      const pattern = new RegExp(`^\\s*(${LAYOUT_PROMPTS.map(escapeRegExp).join('|')})\\s*$`, 'i');
      for (const block of doc.blocks) {
        if (!block.slide || !pattern.test(block.text)) continue;
        findings.push({
          start: block.start,
          end: block.end,
          message: `Slide ${block.slide} still shows PowerPoint's prompt text: "${block.text.trim()}".`,
          note: 'An empty placeholder nobody typed into. Fill it or delete the box.',
        });
      }
      return findings;
    },
  },

  {
    id: 'slides/duplicate-title',
    title: 'Two slides share a title',
    category: 'Slides',
    severity: 'nit',
    check(doc) {
      if (!isDeck(doc)) return [];
      const seen = new Map();
      const findings = [];
      for (const slide of doc.meta.slides || []) {
        if (!slide.title) continue;
        const key = slide.title.trim().toLowerCase();
        if (seen.has(key)) {
          findings.push({
            ...anchorFor(doc, slide.number),
            message: `Slide ${slide.number} repeats the title of slide ${seen.get(key)} ("${slide.title.trim()}").`,
            note: 'Fine for a deliberate "continued" pair; otherwise number them or make them distinct.',
            confidence: 'medium',
          });
        } else seen.set(key, slide.number);
      }
      return findings;
    },
  },

  {
    id: 'slides/speaker-notes-ship-with-the-file',
    title: 'Speaker notes are present in a client deliverable',
    category: 'Release readiness',
    severity: 'major',
    check(doc, ctx) {
      if (!isDeck(doc)) return [];
      if (ctx.config.audience !== 'client') return [];
      const notes = doc.meta.notes || [];
      if (!notes.length) return [];
      const slides = notes.map((n) => n.slide);
      const words = notes.reduce((total, n) => total + n.text.split(/\s+/).filter(Boolean).length, 0);
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: notes.length === 1
          ? `Slide ${slides[0]} carries speaker notes (${words} words).`
          : `${notes.length} slides carry speaker notes (${words} words, slides ${slides.join(', ')}).`,
        note: 'Notes travel inside the .pptx and are visible to anyone who opens it. Read them before issue, or export to PDF without notes.',
        documentLevel: true,
      }];
    },
  },

  {
    id: 'slides/internal-content-in-notes',
    title: 'Internal remarks in the speaker notes',
    category: 'Confidentiality',
    severity: 'blocker',
    check(doc) {
      if (!isDeck(doc)) return [];
      const findings = [];
      // Phrasing that only ever appears in a note to oneself or a colleague.
      const pattern = /\b(?:don'?t mention|do not mention|avoid saying|don'?t share|internal only|between us|off the record|push (?:them |the )?(?:for |on )?(?:more|upsell)|upsell|cross-sell|day rate|margin|our cost|they won'?t know|gloss over|skip this|make (?:it |this )?sound|placeholder|made up|guess(?:ed|timate)|fudge)\b/gi;
      for (const block of doc.blocks) {
        if (block.type !== 'notes') continue;
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(block.text)) !== null) {
          findings.push({
            start: block.start + match.index,
            end: block.start + match.index + match[0].length,
            message: `Slide ${block.slide} notes contain "${match[0]}".`,
            note: 'Speaker notes ship inside the file. Assume the client reads them.',
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'slides/template-leakage',
    title: "Another client's name in the slide layouts",
    category: 'Confidentiality',
    severity: 'blocker',
    check(doc, ctx) {
      if (!isDeck(doc)) return [];
      const forbidden = ctx.config.forbiddenClientNames || [];
      if (!forbidden.length) return [];
      const findings = [];
      for (const entry of doc.meta.templateText || []) {
        for (const name of forbidden) {
          if (!new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(entry.text)) continue;
          findings.push({
            start: 0,
            end: Math.min(1, doc.text.length),
            message: `"${name}" appears in the deck's ${entry.part} ("${entry.text.trim().slice(0, 60)}").`,
            note: 'This is in the template behind the slides, so it will not show up by reading them. Edit the slide master.',
            documentLevel: true,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'slides/comments',
    title: 'Unresolved comments in the deck',
    category: 'Release readiness',
    severity: 'blocker',
    check(doc) {
      if (!isDeck(doc)) return [];
      const comments = doc.meta.comments || [];
      if (!comments.length) return [];
      const preview = comments.slice(0, 3)
        .map((c) => `${c.author || 'unknown'}: "${c.text.slice(0, 60)}"`)
        .join(' | ');
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: `${comments.length} comment${comments.length === 1 ? '' : 's'} still in the deck. ${preview}${comments.length > 3 ? ' ...' : ''}`,
        note: 'Comments travel with the .pptx.',
        documentLevel: true,
      }];
    },
  },
];
