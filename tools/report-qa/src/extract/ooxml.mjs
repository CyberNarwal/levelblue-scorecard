/**
 * Shared plumbing for Office Open XML formats.
 *
 * .docx and .pptx are both ZIP archives of XML parts, so the archive reader,
 * the entity decoder and the relationship parsing live here rather than being
 * written twice. Nothing in this file uses a Node API: DEFLATE comes from our
 * own inflate, the byte reads are done by hand, and text decoding uses
 * TextDecoder, which exists in both Node and the browser.
 */

import { inflateRaw, inflateZlib } from './inflate.mjs';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

const decoder = new TextDecoder('utf-8');

const readU16 = (b, at) => b[at] | (b[at + 1] << 8);
const readU32 = (b, at) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** Decode a byte range as UTF-8. */
export function decodeText(bytes, from, to) {
  return decoder.decode(from === undefined ? bytes : bytes.subarray(from, to));
}

/** Read a ZIP archive into a Map of entry name -> Uint8Array. */
export function readZip(input) {
  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === -1) throw new Error('Not a valid Office file (no ZIP end-of-central-directory record).');

  const entryCount = readU16(buffer, eocd + 10);
  let pointer = readU32(buffer, eocd + 16);
  const entries = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (readU32(buffer, pointer) !== CENTRAL_SIGNATURE) break;
    const method = readU16(buffer, pointer + 10);
    const compressedSize = readU32(buffer, pointer + 20);
    const nameLength = readU16(buffer, pointer + 28);
    const extraLength = readU16(buffer, pointer + 30);
    const commentLength = readU16(buffer, pointer + 32);
    const localOffset = readU32(buffer, pointer + 42);
    const name = decodeText(buffer, pointer + 46, pointer + 46 + nameLength);

    const localNameLength = readU16(buffer, localOffset + 26);
    const localExtraLength = readU16(buffer, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    try {
      if (method === 0) entries.set(name, data.slice());
      else if (method === 8) entries.set(name, inflateRaw(data));
      else if (method === 9) entries.set(name, inflateZlib(data));
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
    if (readU32(buffer, i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Resolve XML entities, including numeric ones. */
export function decodeEntities(value) {
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

/** Read a part as text, or undefined when it is absent. */
export function readPart(entries, name) {
  const data = entries.get(name);
  return data ? decodeText(data) : undefined;
}

/**
 * Parse a `.rels` part into a Map of relationship id -> resolved part path.
 * `base` is the directory the relationships are relative to, e.g. 'ppt/slides'.
 */
export function readRelationships(entries, relsPath, base) {
  const xml = readPart(entries, relsPath);
  const map = new Map();
  if (!xml) return map;
  const re = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    map.set(match[1], resolvePath(base, decodeEntities(match[2])));
  }
  return map;
}

/** Resolve a relationship target against the part's own directory. */
export function resolvePath(base, target) {
  if (/^[a-z]+:\/\//i.test(target)) return target;
  if (target.startsWith('/')) return target.slice(1);
  const segments = base.split('/').filter(Boolean);
  for (const piece of target.split('/')) {
    if (piece === '.' || piece === '') continue;
    if (piece === '..') segments.pop();
    else segments.push(piece);
  }
  return segments.join('/');
}

/** Read docProps/core.xml into a plain metadata object. */
export function parseCoreProperties(xml) {
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
 * Extract the visible text from a DrawingML text body (`<a:t>` runs), which is
 * how PowerPoint stores every piece of text on a slide.
 */
export function drawingTextParagraphs(xml) {
  const paragraphs = [];
  const paragraphRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>|<a:p\b[^>]*\/>/g;
  let match;
  while ((match = paragraphRe.exec(xml)) !== null) {
    const body = match[1] || '';
    let text = '';
    const runRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/?>/g;
    let run;
    while ((run = runRe.exec(body)) !== null) {
      if (run[1] !== undefined) text += decodeEntities(run[1]);
      else text += ' ';
    }
    const level = Number((body.match(/<a:pPr\b[^>]*\blvl="(\d+)"/) || [])[1] || 0);
    const noBullet = /<a:buNone\b/.test(body);
    paragraphs.push({ text: text.trim(), level, noBullet });
  }
  return paragraphs;
}
