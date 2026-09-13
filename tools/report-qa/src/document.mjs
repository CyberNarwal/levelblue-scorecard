/**
 * The document model every rule reads.
 *
 * A Document is a single normalised string plus a list of blocks with absolute
 * offsets. Extractors (markdown, plain text, DOCX, HTML) all produce this same
 * shape, so a rule never needs to know what the draft was authored in.
 *
 * Block types:
 *   heading   - a section heading, with `level` (1-6)
 *   paragraph - a run of prose
 *   listItem  - a bullet or numbered item, with `marker` and `indent`
 *   tableRow  - one row of a table, with `cells`
 *   code      - fenced or indented code, skipped by every prose rule
 *   caption   - a figure/table caption
 */

import {
  buildLineStarts,
  excerptAround,
  normaliseNewlines,
  offsetToPosition,
  splitSentences,
} from './text.mjs';

/** Spans that prose rules must not look inside (code, URLs, paths, hashes). */
const OPAQUE_PATTERNS = [
  /`[^`\n]+`/g,                                   // inline code
  /\bhttps?:\/\/[^\s<>()[\]{}"']+/gi,             // URLs
  /\bwww\.[^\s<>()[\]{}"']+/gi,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,                // email addresses
  /\b(?:[A-Za-z]:\\|\\\\)[^\s"']+/g,              // Windows paths and UNC
  /(?:^|\s)(?:\/[\w.-]+){2,}\/?/gm,               // POSIX paths
  /\b[0-9a-f]{32,64}\b/gi,                        // hashes
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                 // IPv4
  /\b[A-Za-z0-9-]+\.(?:exe|dll|ps1|sh|py|js|json|ya?ml|conf|log|csv|xlsx?|docx?|pdf)\b/gi,
];

export class Document {
  constructor({ text, blocks, source, format, meta = {} }) {
    this.text = text;
    this.blocks = blocks;
    this.source = source;
    this.format = format;
    this.meta = meta;
    this.lineStarts = buildLineStarts(text);
    this.lines = text.split('\n');
    this.opaque = buildOpaqueMask(text, blocks);
    this._sentences = null;
  }

  /** 1-based {line, column} for an absolute offset. */
  position(offset) {
    return offsetToPosition(this.lineStarts, offset);
  }

  excerpt(start, end) {
    return excerptAround(this.text, start, end);
  }

  /** True when the offset sits inside code, a URL, a path or another opaque span. */
  isOpaque(offset) {
    return this.opaque[offset] === 1;
  }

  /** True when any offset in [start, end) is opaque. */
  spanIsOpaque(start, end) {
    for (let i = start; i < end; i += 1) {
      if (this.opaque[i] === 1) return true;
    }
    return false;
  }

  /** Blocks carrying prose that language and punctuation rules should read. */
  proseBlocks() {
    return this.blocks.filter((b) => b.type === 'paragraph' || b.type === 'listItem' || b.type === 'caption');
  }

  headings() {
    return this.blocks.filter((b) => b.type === 'heading');
  }

  /** Every sentence in every prose block, with absolute offsets. Cached. */
  sentences() {
    if (this._sentences) return this._sentences;
    const out = [];
    for (const block of this.proseBlocks()) {
      for (const sentence of splitSentences(block.text, block.start)) {
        out.push({ ...sentence, block });
      }
    }
    this._sentences = out;
    return out;
  }

  /**
   * Run a regex across the document and yield only the matches that fall in
   * scope: inside a wanted block type and outside every opaque span.
   */
  *scan(pattern, { types = null, skipOpaque = true } = {}) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    const blocks = types ? this.blocks.filter((b) => types.includes(b.type)) : this.blocks;
    for (const block of blocks) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(block.text)) !== null) {
        if (match[0] === '') { re.lastIndex += 1; continue; }
        const start = block.start + match.index;
        const end = start + match[0].length;
        if (skipOpaque && this.spanIsOpaque(start, end)) continue;
        yield { match, start, end, block };
      }
    }
  }
}

/** Mark every offset covered by a code span, URL, path or similar. */
function buildOpaqueMask(text, blocks) {
  const mask = new Uint8Array(text.length);
  const cover = (start, end) => {
    for (let i = Math.max(0, start); i < Math.min(text.length, end); i += 1) mask[i] = 1;
  };
  for (const block of blocks) {
    if (block.type === 'code') cover(block.start, block.end);
  }
  for (const pattern of OPAQUE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match[0] === '') { re.lastIndex += 1; continue; }
      cover(match.index, match.index + match[0].length);
    }
  }
  return mask;
}

const ATX_HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)]|[a-z][.)])\s+(.*)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_DIVIDER = /^\s*\|[\s:|-]+\|\s*$/;
const CAPTION = /^\s*(?:figure|fig\.|table|exhibit|chart|diagram)\s*\d+[.:)]?\s+\S/i;

/**
 * Parse markdown or plain text into blocks. Plain text simply produces
 * paragraphs and whatever headings look unambiguous.
 */
export function parseMarkdown(raw, { source = 'draft', format = 'markdown' } = {}) {
  const text = normaliseNewlines(raw);
  const lines = text.split('\n');
  const lineStarts = buildLineStarts(text);
  const blocks = [];

  let paragraph = null;
  const flush = () => {
    if (!paragraph) return;
    const joined = paragraph.lines.join('\n');
    blocks.push({
      type: paragraph.type,
      text: joined,
      start: paragraph.start,
      end: paragraph.start + joined.length,
      line: paragraph.line,
    });
    paragraph = null;
  };

  let inFence = false;
  let fenceMarker = '';
  let fenceStart = 0;
  let fenceLine = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineStart = lineStarts[i];
    const fence = line.match(/^\s*(```+|~~~+)/);

    if (inFence) {
      if (fence && line.trim().startsWith(fenceMarker)) {
        const end = lineStart + line.length;
        blocks.push({ type: 'code', text: text.slice(fenceStart, end), start: fenceStart, end, line: fenceLine });
        inFence = false;
      }
      continue;
    }
    if (fence) {
      flush();
      inFence = true;
      fenceMarker = fence[1];
      fenceStart = lineStart;
      fenceLine = i + 1;
      continue;
    }

    if (!line.trim()) { flush(); continue; }

    const heading = line.match(ATX_HEADING);
    if (heading) {
      flush();
      const offset = lineStart + line.indexOf(heading[2]);
      blocks.push({
        type: 'heading',
        text: heading[2],
        start: offset,
        end: offset + heading[2].length,
        line: i + 1,
        level: heading[1].length,
      });
      continue;
    }

    // Setext headings: a line of === or --- directly under text.
    const next = lines[i + 1];
    if (next && /^\s*(={3,}|-{3,})\s*$/.test(next) && line.trim() && !LIST_ITEM.test(line)) {
      flush();
      const offset = lineStart + (line.length - line.trimStart().length);
      blocks.push({
        type: 'heading',
        text: line.trim(),
        start: offset,
        end: offset + line.trim().length,
        line: i + 1,
        level: next.trim().startsWith('=') ? 1 : 2,
      });
      i += 1;
      continue;
    }

    if (TABLE_ROW.test(line)) {
      flush();
      if (TABLE_DIVIDER.test(line)) continue;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      blocks.push({
        type: 'tableRow',
        text: line.trim(),
        start: lineStart + (line.length - line.trimStart().length),
        end: lineStart + line.trimEnd().length,
        line: i + 1,
        cells,
      });
      continue;
    }

    const item = line.match(LIST_ITEM);
    if (item) {
      flush();
      const body = item[3];
      blocks.push({
        type: 'listItem',
        text: body,
        start: lineStart + line.indexOf(body, item[1].length + item[2].length),
        end: lineStart + line.trimEnd().length,
        line: i + 1,
        marker: item[2],
        indent: item[1].length,
        ordered: /\d|[a-z]/.test(item[2][0]),
      });
      continue;
    }

    if (CAPTION.test(line)) {
      flush();
      const offset = lineStart + (line.length - line.trimStart().length);
      blocks.push({ type: 'caption', text: line.trim(), start: offset, end: lineStart + line.trimEnd().length, line: i + 1 });
      continue;
    }

    if (!paragraph) {
      paragraph = {
        type: 'paragraph',
        lines: [],
        start: lineStart + (line.length - line.trimStart().length),
        line: i + 1,
      };
    }
    paragraph.lines.push(paragraph.lines.length === 0 ? line.trimStart() : line);
  }
  flush();

  if (inFence) {
    blocks.push({ type: 'code', text: text.slice(fenceStart), start: fenceStart, end: text.length, line: fenceLine });
  }

  return new Document({ text, blocks, source, format });
}

/**
 * Build a Document from already-structured paragraphs (the DOCX path).
 * Each paragraph becomes one line, so a reported "line" is a paragraph number.
 */
export function documentFromParagraphs(paragraphs, { source, format, meta }) {
  const parts = [];
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    const p = paragraphs[i];
    const content = p.text ?? '';
    blocks.push({
      type: p.type || 'paragraph',
      text: content,
      start: offset,
      end: offset + content.length,
      line: i + 1,
      level: p.level,
      marker: p.marker,
      indent: p.indent || 0,
      ordered: p.ordered,
      cells: p.cells,
      style: p.style,
      region: p.region,
    });
    parts.push(content);
    offset += content.length + 1;
  }
  const text = parts.join('\n');
  return new Document({ text, blocks, source, format, meta });
}
