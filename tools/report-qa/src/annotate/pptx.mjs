/**
 * Write findings into a copy of the deck as real PowerPoint comments.
 *
 * PresentationML comments are anchored to a slide and a position, not to a run
 * of text, which is why this is tractable where the Word equivalent is not: the
 * checker already knows which slide a finding came from, and nothing has to be
 * spliced into the slide's own XML. The slide parts are never touched.
 *
 * The original bytes are never modified. Every part we are not adding to is
 * copied across still compressed, so the deck that comes out is the deck that
 * went in plus some comment XML.
 */

import { readZip, readZipEntries, readPart, readRelationships } from '../extract/ooxml.mjs';
import { findingComment } from '../report.mjs';
import { writeZip } from './zip.mjs';

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL_COMMENTS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
const REL_AUTHORS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/commentAuthors';
const TYPE_COMMENTS = 'application/vnd.openxmlformats-officedocument.presentationml.comments+xml';
const TYPE_AUTHORS = 'application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Replace the control characters XML 1.0 cannot represent at all. Office text
 * should never hold one, but a draft that has been through three other tools
 * might, and a single stray byte makes the whole package unopenable.
 */
function stripIllegalXml(value) {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    out += code < 0x20 && code !== 9 && code !== 10 && code !== 13 ? ' ' : ch;
  }
  return out;
}

function escapeXml(value) {
  return stripIllegalXml(String(value))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
  return [...entries.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
}

/**
 * Find our author in the deck's author list, adding one if this is the first
 * time. Existing authors are left exactly as they are, so a reviewer's own
 * comments keep their name.
 */
function resolveAuthors(parts, authorName) {
  const existing = readPart(parts, 'ppt/commentAuthors.xml');
  if (existing) {
    const escaped = authorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mine = new RegExp(`<p:cmAuthor\\b[^>]*\\bid="(\\d+)"[^>]*\\bname="${escaped}"`).exec(existing);
    if (mine) return { id: Number(mine[1]), xml: null };

    let highest = -1;
    const re = /<p:cmAuthor\b[^>]*\bid="(\d+)"/g;
    let match;
    while ((match = re.exec(existing)) !== null) highest = Math.max(highest, Number(match[1]));
    const id = highest + 1;
    const entry = `<p:cmAuthor id="${id}" name="${escapeXml(authorName)}" initials="QA" lastIdx="1" clrIdx="${id}"/>`;
    return { id, xml: existing.replace('</p:cmAuthorLst>', `${entry}</p:cmAuthorLst>`) };
  }

  const xml = `${XML_HEAD}<p:cmAuthorLst xmlns:p="${NS_P}">`
    + `<p:cmAuthor id="1" name="${escapeXml(authorName)}" initials="QA" lastIdx="1" clrIdx="0"/>`
    + '</p:cmAuthorLst>';
  return { id: 1, xml };
}

/** Comments already on the slide, so adding ours does not delete theirs. */
function existingComments(xml) {
  if (!xml) return { body: '', nextIdx: 1 };
  const body = /<p:cmLst\b[^>]*>([\s\S]*)<\/p:cmLst>/.exec(xml)?.[1] ?? '';
  let highest = 0;
  const re = /<p:cm\b[^>]*\bidx="(\d+)"/g;
  let match;
  while ((match = re.exec(body)) !== null) highest = Math.max(highest, Number(match[1]));
  return { body, nextIdx: highest + 1 };
}

function relationshipsXml(existing, additions) {
  if (!existing) {
    return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `${additions}</Relationships>`;
  }
  return existing.replace(/<\/Relationships>\s*$/, `${additions}</Relationships>`);
}

/** The next rId that is free in a relationships part. */
function freeRelId(xml) {
  let highest = 0;
  const re = /\bId="rId(\d+)"/g;
  let match;
  while (xml && (match = re.exec(xml)) !== null) highest = Math.max(highest, Number(match[1]));
  return `rId${highest + 1}`;
}

/**
 * Return a copy of `buffer` with one comment per finding, on the slide the
 * finding came from. Findings with no slide of their own - the ones about the
 * file as a whole - are collected onto the first slide, where someone opening
 * the deck will see them.
 */
export function annotatePptx(buffer, findings, { author = 'Report QA', now = new Date() } = {}) {
  const raw = readZipEntries(buffer);
  const parts = readZip(buffer);
  const slides = slidePartsInOrder(parts);
  if (!slides.length) throw new Error('No slides found in this deck, so there is nowhere to put comments.');

  const bySlide = new Map();
  for (const finding of findings) {
    const index = finding.slide && finding.slide <= slides.length ? finding.slide - 1 : 0;
    if (!bySlide.has(index)) bySlide.set(index, []);
    bySlide.get(index).push(finding);
  }
  if (!bySlide.size) throw new Error('Nothing to write: there are no findings left to comment on.');

  const authors = resolveAuthors(parts, author);
  const replaced = new Map();
  const added = [];
  if (authors.xml) replaced.set('ppt/commentAuthors.xml', authors.xml);

  // A comment part number that is not already taken, so an existing
  // comment1.xml belonging to a real reviewer is never overwritten.
  let nextPart = 1;
  const taken = (n) => parts.has(`ppt/comments/comment${n}.xml`) || replaced.has(`ppt/comments/comment${n}.xml`);
  const stamp = now.toISOString();

  for (const [index, group] of [...bySlide.entries()].sort((a, b) => a[0] - b[0])) {
    const slidePart = slides[index];
    const relsPart = `ppt/slides/_rels/${slidePart.split('/').pop()}.rels`;
    const relsXml = readPart(parts, relsPart);
    const rels = readRelationships(parts, relsPart, 'ppt/slides');

    // Reuse the slide's own comment part when it has one, so existing comments
    // survive; otherwise take the next free file name.
    let commentPart = [...rels.values()].find((target) => /ppt\/comments\/comment\d+\.xml$/.test(target));
    if (!commentPart) {
      while (taken(nextPart)) nextPart += 1;
      commentPart = `ppt/comments/comment${nextPart}.xml`;
      nextPart += 1;
      const id = freeRelId(relsXml);
      const addition = `<Relationship Id="${id}" Type="${REL_COMMENTS}" `
        + `Target="../comments/${commentPart.split('/').pop()}"/>`;
      replaced.set(relsPart, relationshipsXml(relsXml, addition));
      if (!parts.has(relsPart)) added.push(relsPart);
    }

    const { body, nextIdx } = existingComments(replaced.get(commentPart) ?? readPart(parts, commentPart));
    const ours = group.map((finding, offset) => {
      // The slide is already named by the comment being on it, so the location
      // is only repeated when it points somewhere the slide does not show.
      const text = findingComment(finding, { withLocation: finding.region === 'notes' || !finding.slide });
      const step = ((nextIdx + offset) % 12) * 120;
      return `<p:cm authorId="${authors.id}" dt="${stamp}" idx="${nextIdx + offset}">`
        + `<p:pos x="${10 + step}" y="${10 + step}"/>`
        + `<p:text>${escapeXml(text)}</p:text>`
        + '</p:cm>';
    }).join('');

    if (!parts.has(commentPart)) added.push(commentPart);
    replaced.set(commentPart, `${XML_HEAD}<p:cmLst xmlns:p="${NS_P}">${body}${ours}</p:cmLst>`);
  }

  // The author list has to be reachable from the presentation, or PowerPoint
  // shows the comments with nobody's name against them.
  if (!parts.has('ppt/commentAuthors.xml')) {
    added.push('ppt/commentAuthors.xml');
    const presRelsPart = 'ppt/_rels/presentation.xml.rels';
    const presRels = readPart(parts, presRelsPart);
    const id = freeRelId(presRels);
    replaced.set(presRelsPart, relationshipsXml(
      presRels,
      `<Relationship Id="${id}" Type="${REL_AUTHORS}" Target="commentAuthors.xml"/>`,
    ));
    if (!parts.has(presRelsPart)) added.push(presRelsPart);
  }

  replaced.set('[Content_Types].xml', contentTypesWith(parts, added));

  const entries = [];
  for (const [name, entry] of raw) {
    entries.push(replaced.has(name) ? { name, text: replaced.get(name) } : { name, raw: entry });
  }
  for (const name of added) {
    if (!raw.has(name)) entries.push({ name, text: replaced.get(name) });
  }
  return writeZip(entries);
}

/** Declare every part we added, or the package will not open. */
function contentTypesWith(parts, added) {
  let xml = readPart(parts, '[Content_Types].xml');
  if (!xml) throw new Error('This file has no [Content_Types].xml, so it is not a readable Office package.');

  if (!/\bExtension="rels"/i.test(xml)) {
    xml = xml.replace(/<Types\b[^>]*>/, (open) => `${open}<Default Extension="rels" `
      + 'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>');
  }
  if (!/\bExtension="xml"/i.test(xml)) {
    xml = xml.replace(/<Types\b[^>]*>/, (open) => `${open}<Default Extension="xml" ContentType="application/xml"/>`);
  }

  const overrides = [];
  for (const name of added) {
    if (name.endsWith('.rels')) continue;
    const type = name === 'ppt/commentAuthors.xml' ? TYPE_AUTHORS : TYPE_COMMENTS;
    if (!xml.includes(`PartName="/${name}"`)) {
      overrides.push(`<Override PartName="/${name}" ContentType="${type}"/>`);
    }
  }
  return xml.replace('</Types>', `${overrides.join('')}</Types>`);
}
