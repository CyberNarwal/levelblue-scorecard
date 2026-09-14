/**
 * Turn a file on disk into a Document, whatever it was authored in.
 */

import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

import { documentFromParagraphs, parseMarkdown } from './document.mjs';
import { extractDocx } from './extract/docx.mjs';
import { extractPptx } from './extract/pptx.mjs';

const TEXT_FORMATS = new Set(['.md', '.markdown', '.txt', '.text', '.rst', '.adoc']);

export function loadDocument(path) {
  const extension = extname(path).toLowerCase();
  const source = basename(path);

  if (extension === '.docx' || extension === '.docm') {
    const { paragraphs, meta } = extractDocx(readFileSync(path));
    return documentFromParagraphs(paragraphs, { source, format: 'docx', meta });
  }

  if (extension === '.pptx' || extension === '.pptm' || extension === '.potx') {
    const { paragraphs, meta } = extractPptx(readFileSync(path));
    return documentFromParagraphs(paragraphs, { source, format: 'pptx', meta });
  }

  if (extension === '.ppt') {
    throw new Error('Legacy .ppt is not supported. Save as .pptx and re-run.');
  }

  if (extension === '.html' || extension === '.htm') {
    return parseMarkdown(htmlToText(readFileSync(path, 'utf8')), { source, format: 'html' });
  }

  if (extension === '.pdf') {
    throw new Error(
      'PDF is not supported: extracting text from PDF without a heavy dependency is unreliable, '
      + 'and QA on mis-extracted text is worse than no QA. Run the check against the source '
      + '.docx or .md instead.',
    );
  }

  if (extension === '.doc') {
    throw new Error('Legacy .doc is not supported. Save as .docx and re-run.');
  }

  if (!TEXT_FORMATS.has(extension) && extension !== '') {
    // Try it as text anyway rather than refusing outright.
    process.emitWarning(`Unknown extension "${extension}" - reading as plain text.`);
  }

  return parseMarkdown(readFileSync(path, 'utf8'), {
    source,
    format: TEXT_FORMATS.has(extension) ? 'markdown' : 'text',
  });
}

/**
 * Minimal HTML to text: enough to QA an exported report, not a browser.
 * Block elements become paragraphs; headings keep their level as Markdown.
 */
function htmlToText(html) {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');

  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => `\n\n${'#'.repeat(Number(level))} ${strip(body)}\n\n`);
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => `\n- ${strip(body)}`);
  text = text.replace(/<\/(p|div|tr|table|ul|ol|section|article|blockquote)>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  return decodeEntities(text).replace(/\n{3,}/g, '\n\n');
}

function strip(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[body] ?? whole;
  });
}
