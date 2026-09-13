/**
 * Zero-dependency DOCX reader.
 *
 * A .docx is a ZIP of XML parts. We read the central directory ourselves and
 * inflate the parts we care about, then pull paragraphs out of the WordprocessingML
 * with targeted regexes rather than a full XML parser. That is enough to recover
 * paragraph text, heading levels, list structure, tables, and - importantly for
 * report QA - the things that should never survive into a client deliverable:
 * unresolved comments, tracked changes and leftover highlighting.
 */

import { inflateRawSync, inflateSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** Read a ZIP archive into a Map of entry name -> Buffer. */
export function readZip(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === -1) throw new Error('Not a valid ZIP/DOCX file (no end-of-central-directory record).');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let pointer = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(pointer) !== CENTRAL_SIGNATURE) break;
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength);

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    try {
      if (method === 0) entries.set(name, Buffer.from(data));
      else if (method === 8) entries.set(name, inflateRawSync(data));
      else if (method === 9) entries.set(name, inflateSync(data));
    } catch {
      // A part we cannot inflate is skipped rather than failing the whole read.
    }
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body] ?? whole;
  });
}

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

/** Read docProps/core.xml into a plain metadata object. */
function parseCoreProperties(xml) {
  if (!xml) return {};
  const pick = (tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? decodeEntities(m[1]).trim() : undefined;
  };
  return {
    title: pick('dc:title'),
    subject: pick('dc:subject'),
    author: pick('dc:creator'),
    lastModifiedBy: pick('cp:lastModifiedBy'),
    revision: pick('cp:revision'),
    created: pick('dcterms:created'),
    modified: pick('dcterms:modified'),
    category: pick('cp:category'),
    keywords: pick('cp:keywords'),
  };
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
  const bodyXml = documentXml.toString('utf8');
  const paragraphs = parseBody(bodyXml, 'body', state);

  const headerFooterText = [];
  for (const [name, data] of entries) {
    if (!/^word\/(header|footer)\d*\.xml$/.test(name)) continue;
    const region = name.includes('header') ? 'header' : 'footer';
    for (const p of parseBody(data.toString('utf8'), region, { commentAnchors: [], insertions: [], deletions: [], highlights: [] })) {
      if (p.text.trim()) headerFooterText.push(p.text.trim());
    }
  }

  const commentsXml = entries.get('word/comments.xml');
  const comments = [];
  if (commentsXml) {
    const re = /<w:comment\s[^>]*w:author="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g;
    let m;
    while ((m = re.exec(commentsXml.toString('utf8'))) !== null) {
      comments.push({ author: decodeEntities(m[1]), text: paragraphText(m[2]).trim() });
    }
  }

  const meta = {
    ...parseCoreProperties(entries.get('docProps/core.xml')?.toString('utf8')),
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
