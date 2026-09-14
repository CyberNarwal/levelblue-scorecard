/**
 * Zero-dependency PowerPoint reader.
 *
 * A .pptx is a ZIP of XML parts like a .docx, but the text lives in DrawingML
 * shapes rather than a linear document body, so "where is this finding" means a
 * slide number rather than a line.
 *
 * What matters for report QA, beyond the words on the slides:
 *
 *  - Speaker notes ship inside the file. Anyone who opens the deck can read
 *    them, and they are where "don't mention the day rate" ends up.
 *  - Slide layouts and masters carry the previous client's name long after the
 *    slides have been rewritten.
 *  - PowerPoint's own prompt text ("Click to edit Master title style") survives
 *    in any placeholder nobody typed into.
 *  - Comments travel with the deck, same as in Word.
 */

import {
  decodeEntities,
  drawingTextParagraphs,
  parseCoreProperties,
  readPart,
  readRelationships,
  readZip,
} from './ooxml.mjs';

/** Placeholder types that hold a slide's title. */
const TITLE_PLACEHOLDERS = new Set(['title', 'ctrTitle']);

/** Auto-populated furniture, not authored prose. */
const FURNITURE_PLACEHOLDERS = new Set(['sldNum', 'ftr', 'dt']);

/** PowerPoint's default prompt text, which should never survive into a deck. */
export const LAYOUT_PROMPTS = [
  'Click to edit Master title style',
  'Click to edit Master text styles',
  'Click to add title',
  'Click to add subtitle',
  'Click to add text',
  'Click to add notes',
  'Second level',
  'Third level',
  'Fourth level',
  'Fifth level',
];

/** Slide order comes from the presentation part, not from file names. */
function slidePartsInOrder(entries) {
  const presentation = readPart(entries, 'ppt/presentation.xml');
  const rels = readRelationships(entries, 'ppt/_rels/presentation.xml.rels', 'ppt');

  if (presentation && rels.size) {
    const ordered = [];
    const re = /<p:sldId\b[^>]*\br:id="([^"]+)"/g;
    let match;
    while ((match = re.exec(presentation)) !== null) {
      const target = rels.get(match[1]);
      if (target && entries.has(target)) ordered.push(target);
    }
    if (ordered.length) return ordered;
  }

  // Fall back to natural-sorted file names when the presentation part is odd.
  return [...entries.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
}

/** Split a slide's shape tree into individual shapes, keeping document order. */
function shapesOf(xml) {
  const shapes = [];
  const re = /<p:sp\b[\s\S]*?<\/p:sp>|<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g;
  let match;
  while ((match = re.exec(xml)) !== null) shapes.push(match[0]);
  return shapes;
}

function placeholderType(shapeXml) {
  const match = shapeXml.match(/<p:ph\b[^>]*\btype="([^"]+)"/);
  if (match) return match[1];
  // A <p:ph> with no type attribute is a body placeholder by default.
  return /<p:ph\b/.test(shapeXml) ? 'body' : null;
}

/** Pull table rows out of a graphic frame. */
function tableRows(shapeXml) {
  const rows = [];
  const rowRe = /<a:tr\b[\s\S]*?<\/a:tr>/g;
  let row;
  while ((row = rowRe.exec(shapeXml)) !== null) {
    const cells = [];
    const cellRe = /<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g;
    let cell;
    while ((cell = cellRe.exec(row[0])) !== null) {
      cells.push(drawingTextParagraphs(cell[1]).map((p) => p.text).filter(Boolean).join(' '));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** Collect every piece of text in a part, for scanning template furniture. */
function allTextIn(xml) {
  if (!xml) return [];
  return drawingTextParagraphs(xml).map((p) => p.text).filter(Boolean);
}

/**
 * Extract a PPTX buffer into { paragraphs, meta }.
 *
 * Paragraphs carry a `slide` number so findings can be reported as "Slide 4"
 * instead of a line number that means nothing in a deck.
 */
export function extractPptx(buffer) {
  const entries = readZip(buffer);
  const slideParts = slidePartsInOrder(entries);
  if (!slideParts.length) throw new Error('PPTX contains no slides.');

  const paragraphs = [];
  const notes = [];
  const slides = [];

  slideParts.forEach((part, index) => {
    const slideNumber = index + 1;
    const xml = readPart(entries, part) || '';
    const summary = { number: slideNumber, title: null, words: 0, bullets: 0, maxDepth: 0, shapes: 0, empty: true };

    for (const shape of shapesOf(xml)) {
      const type = placeholderType(shape);
      if (type && FURNITURE_PLACEHOLDERS.has(type)) continue;

      if (/<a:tbl\b/.test(shape)) {
        for (const cells of tableRows(shape)) {
          paragraphs.push({ type: 'tableRow', text: cells.join(' | '), cells, slide: slideNumber });
          summary.words += cells.join(' ').split(/\s+/).filter(Boolean).length;
          summary.empty = false;
        }
        summary.shapes += 1;
        continue;
      }

      const bodyMatch = shape.match(/<p:txBody\b[\s\S]*?<\/p:txBody>/);
      if (!bodyMatch) continue;
      const lines = drawingTextParagraphs(bodyMatch[0]).filter((p) => p.text);
      if (!lines.length) continue;
      summary.shapes += 1;
      summary.empty = false;

      if (TITLE_PLACEHOLDERS.has(type)) {
        const title = lines.map((l) => l.text).join(' ');
        summary.title = title;
        summary.words += title.split(/\s+/).filter(Boolean).length;
        paragraphs.push({ type: 'heading', level: 1, text: title, slide: slideNumber });
        continue;
      }

      for (const line of lines) {
        summary.words += line.text.split(/\s+/).filter(Boolean).length;
        summary.maxDepth = Math.max(summary.maxDepth, line.level);
        // Placeholder body text is bulleted unless the author turned it off;
        // a free-standing text box is prose.
        const bulleted = !line.noBullet && (type === 'body' || type === 'subTitle' || line.level > 0);
        if (bulleted) summary.bullets += 1;
        paragraphs.push({
          type: bulleted ? 'listItem' : 'paragraph',
          text: line.text,
          indent: line.level,
          marker: '-',
          slide: slideNumber,
        });
      }
    }

    // Speaker notes: read through the slide's own relationships so an unusual
    // numbering scheme does not attach the wrong notes to a slide.
    const relName = `ppt/slides/_rels/${part.split('/').pop()}.rels`;
    const slideRels = readRelationships(entries, relName, 'ppt/slides');
    let notesPart = [...slideRels.values()].find((target) => /notesSlide\d*\.xml$/.test(target));
    if (!notesPart) {
      const guess = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
      if (entries.has(guess)) notesPart = guess;
    }
    if (notesPart) {
      const notesXml = readPart(entries, notesPart) || '';
      const notesText = [];
      for (const shape of shapesOf(notesXml)) {
        if (placeholderType(shape) === 'sldNum') continue;
        const body = shape.match(/<p:txBody\b[\s\S]*?<\/p:txBody>/);
        if (!body) continue;
        for (const line of drawingTextParagraphs(body[0])) {
          // The notes pane repeats the slide's own text; skip that copy.
          if (!line.text || line.text === summary.title) continue;
          notesText.push(line.text);
        }
      }
      if (notesText.length) {
        notes.push({ slide: slideNumber, text: notesText.join('\n') });
        for (const line of notesText) {
          paragraphs.push({ type: 'notes', text: line, slide: slideNumber, region: 'notes' });
        }
      }
    }

    slides.push(summary);
  });

  // Layouts and masters: not part of the prose, but they carry template
  // furniture, so they are scanned separately for another client's name.
  const templateText = [];
  for (const name of entries.keys()) {
    if (!/^ppt\/(slideLayouts|slideMasters|notesMasters|handoutMasters)\/[^/]+\.xml$/.test(name)) continue;
    for (const line of allTextIn(readPart(entries, name))) {
      if (LAYOUT_PROMPTS.includes(line)) continue;
      templateText.push({ part: name.split('/')[1], text: line });
    }
  }

  const comments = [];
  const authors = new Map();
  const authorsXml = readPart(entries, 'ppt/commentAuthors.xml');
  if (authorsXml) {
    const re = /<p:cmAuthor\b[^>]*\bid="(\d+)"[^>]*\bname="([^"]*)"/g;
    let match;
    while ((match = re.exec(authorsXml)) !== null) authors.set(match[1], decodeEntities(match[2]));
  }
  for (const name of entries.keys()) {
    if (!/^ppt\/comments\/.*\.xml$/.test(name)) continue;
    const xml = readPart(entries, name) || '';
    // Classic comments carry the text in an attribute-bearing element; modern
    // comments (Microsoft 365) use a DrawingML body.
    const classic = /<p:cm\b[^>]*\bauthorId="(\d+)"[^>]*>[\s\S]*?<p:text>([\s\S]*?)<\/p:text>/g;
    let match;
    while ((match = classic.exec(xml)) !== null) {
      comments.push({ author: authors.get(match[1]) || 'unknown', text: decodeEntities(match[2]).trim() });
    }
    if (!comments.length) {
      for (const line of allTextIn(xml)) comments.push({ author: 'unknown', text: line });
    }
  }

  const meta = {
    ...parseCoreProperties(readPart(entries, 'docProps/core.xml')),
    slideCount: slideParts.length,
    slides,
    notes,
    comments,
    templateText,
    imageCount: [...entries.keys()].filter((n) => n.startsWith('ppt/media/')).length,
    // Word-only concepts, declared so the shared rules can check them safely.
    headerFooterText: [],
    trackedInsertions: 0,
    trackedDeletions: 0,
    highlights: [],
  };

  return { paragraphs, meta };
}
