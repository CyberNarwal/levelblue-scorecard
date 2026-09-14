/**
 * Zero-dependency DOCX reader.
 *
 * A .docx is a ZIP of XML parts. The archive reading and entity decoding are
 * shared with the PowerPoint reader in ooxml.mjs; this file handles
 * WordprocessingML itself, pulling out paragraph text, heading levels, list
 * structure, tables, and - importantly for report QA - the things that should
 * never survive into a client deliverable: unresolved comments, tracked changes
 * and leftover highlighting.
 */

import { decodeEntities, decodeText, parseCoreProperties, readPart, readZip } from './ooxml.mjs';

export { readZip };

/** Pull the visible text out of one <w:p> element. */
function paragraphText(xml) {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>|<w:noBreakHyphen\s*\/>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    if (match[1] !== undefined) out += decodeEntities(match[1]);
    else if (match[0].startsWith('<w:tab')) out += '\t';
    else if (match[0].startsWith('<w:noBreakHyphen')) out += '-';
    else out += ' ';
  }
  return out;
}

function headingLevel(styleId) {
  if (!styleId) return null;
  const m = styleId.match(/^Heading(\d)$/i) || styleId.match(/^heading\s*(\d)$/i);
  if (m) return Number(m[1]);
  if (/^Title$/i.test(styleId)) return 1;
  if (/^Subtitle$/i.test(styleId)) return 2;
  return null;
}

/**
 * Convert a WordprocessingML body into the paragraph list the document model
 * expects, plus a set of document-level observations.
 */
function parseBody(xml, region, state) {
  const paragraphs = [];
  // Walk tables and loose paragraphs in document order.
  const re = /<w:tbl[\s>][\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('<w:tbl')) {
      const rowRe = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
      let row;
      while ((row = rowRe.exec(chunk)) !== null) {
        const cells = [];
        const cellRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
        let cell;
        while ((cell = cellRe.exec(row[0])) !== null) {
          const cellParas = [];
          const pRe = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
          let p;
          while ((p = pRe.exec(cell[1])) !== null) cellParas.push(paragraphText(p[0]).trim());
          cells.push(cellParas.filter(Boolean).join(' '));
        }
        collectObservations(row[0], state, paragraphs.length);
        paragraphs.push({
          type: 'tableRow',
          text: cells.join(' | '),
          cells,
          region,
        });
      }
      continue;
    }

    const text = paragraphText(chunk);
    const styleId = (chunk.match(/<w:pStyle\s+w:val="([^"]+)"/) || [])[1] || null;
    const level = headingLevel(styleId);
    const isList = /<w:numPr[\s>]/.test(chunk);
    const indentTwips = Number((chunk.match(/<w:ind[^>]*\sw:left="(\d+)"/) || [])[1] || 0);

    collectObservations(chunk, state, paragraphs.length);

    if (!text.trim()) {
      paragraphs.push({ type: 'blank', text: '', region, style: styleId });
      continue;
    }
    if (level) {
      paragraphs.push({ type: 'heading', text: text.trim(), level, region, style: styleId });
      continue;
    }
    if (isList) {
      paragraphs.push({
        type: 'listItem',
        text: text.trim(),
        marker: /<w:numFmt\s+w:val="bullet"/.test(chunk) ? '-' : '1.',
        indent: Math.round(indentTwips / 360),
        ordered: !/bullet/i.test(chunk),
        region,
        style: styleId,
      });
      continue;
    }
    if (/^Caption$/i.test(styleId || '')) {
      paragraphs.push({ type: 'caption', text: text.trim(), region, style: styleId });
      continue;
    }
    paragraphs.push({ type: 'paragraph', text: text.trim(), region, style: styleId });
  }
  return paragraphs;
}

/** Record editorial residue that must not reach a client: comments, revisions, highlights. */
function collectObservations(chunk, state, paragraphIndex) {
  if (/<w:commentRangeStart[\s>]/.test(chunk)) {
    state.commentAnchors.push(paragraphIndex + 1);
  }
  if (/<w:ins[\s>]/.test(chunk)) state.insertions.push(paragraphIndex + 1);
  if (/<w:del[\s>]/.test(chunk)) state.deletions.push(paragraphIndex + 1);
  const highlight = chunk.match(/<w:highlight\s+w:val="(?!none")([^"]+)"/);
  if (highlight) state.highlights.push({ line: paragraphIndex + 1, colour: highlight[1] });
}

/**
 * Extract a DOCX buffer into { paragraphs, meta }.
 * Headers and footers are appended as their own region so classification
 * markings and footer boilerplate can still be checked.
 */
export function extractDocx(buffer) {
  const entries = readZip(buffer);
  const documentXml = entries.get('word/document.xml');
  if (!documentXml) throw new Error('DOCX is missing word/document.xml.');

  const state = { commentAnchors: [], insertions: [], deletions: [], highlights: [] };
  const bodyXml = decodeText(documentXml);
  const paragraphs = parseBody(bodyXml, 'body', state);

  const headerFooterText = [];
  for (const [name, data] of entries) {
    if (!/^word\/(header|footer)\d*\.xml$/.test(name)) continue;
    const region = name.includes('header') ? 'header' : 'footer';
    for (const p of parseBody(decodeText(data), region, { commentAnchors: [], insertions: [], deletions: [], highlights: [] })) {
      if (p.text.trim()) headerFooterText.push(p.text.trim());
    }
  }

  const commentsXml = entries.get('word/comments.xml');
  const comments = [];
  if (commentsXml) {
    const re = /<w:comment\s[^>]*w:author="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g;
    let m;
    while ((m = re.exec(decodeText(commentsXml))) !== null) {
      comments.push({ author: decodeEntities(m[1]), text: paragraphText(m[2]).trim() });
    }
  }

  const meta = {
    ...parseCoreProperties(readPart(entries, 'docProps/core.xml')),
    headerFooterText,
    comments,
    trackedInsertions: state.insertions.length,
    trackedDeletions: state.deletions.length,
    trackedChangeLines: [...new Set([...state.insertions, ...state.deletions])],
    highlights: state.highlights,
    hasEmbeddedImages: [...entries.keys()].some((n) => n.startsWith('word/media/')),
    imageCount: [...entries.keys()].filter((n) => n.startsWith('word/media/')).length,
  };

  return { paragraphs, meta };
}
