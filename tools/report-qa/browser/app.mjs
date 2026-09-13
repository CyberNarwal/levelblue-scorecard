/**
 * Browser entry for the standalone offline QA page.
 *
 * Everything here runs in the viewer's own browser from a file:// URL. There is
 * no server, no network call and no upload - the report is read with FileReader
 * and analysed in memory. That property is the whole point of the page, so
 * nothing in this file may introduce a fetch, a CDN reference or an analytics
 * call.
 */

import { resolveConfig, SEVERITIES } from '../src/config.mjs';
import { documentFromParagraphs, parseMarkdown } from '../src/document.mjs';
import { analyse } from '../src/engine.mjs';
import { extractDocx } from '../src/extract/docx.mjs';
import { formatMarkdown } from '../src/report.mjs';

/** House defaults baked in at build time from report-qa.config.json. */
const BUILT_IN_CONFIG = typeof __HOUSE_CONFIG__ === 'undefined' ? {} : __HOUSE_CONFIG__;

const SEVERITY_LABEL = { blocker: 'Blocker', major: 'Major', minor: 'Minor', nit: 'Nit' };
const SEVERITY_BLURB = {
  blocker: 'Must not reach the client.',
  major: 'Wrong, or reads as wrong.',
  minor: 'Inconsistent with itself.',
  nit: 'Preference - fix if you have time.',
};

const STORAGE_KEY = 'report-qa.settings.v1';

const el = (id) => document.getElementById(id);

/** Settings persist per browser. file:// storage can be blocked, so never assume. */
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private window, or file:// storage disabled. The page still works.
  }
}

function readSettingsFromForm() {
  return {
    dialect: el('dialect').value,
    clientName: el('clientName').value.trim(),
    otherClients: el('otherClients').value.trim(),
    classification: el('classification').value.trim(),
  };
}

function applySettingsToForm(settings) {
  el('dialect').value = settings.dialect || BUILT_IN_CONFIG.dialect || 'auto';
  el('clientName').value = settings.clientName || '';
  el('otherClients').value = settings.otherClients || '';
  el('classification').value = settings.classification || '';
}

/** Turn the form into the config shape the engine expects. */
function buildConfig(settings) {
  const others = settings.otherClients
    ? settings.otherClients.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return resolveConfig(BUILT_IN_CONFIG, {
    dialect: settings.dialect || 'auto',
    client: { name: settings.clientName || '', aliases: [] },
    forbiddenClientNames: others,
    classification: settings.classification || '',
  });
}

/** Read a dropped or chosen File into a Document. */
async function readDocument(file) {
  const name = file.name || 'draft';
  const extension = name.toLowerCase().slice(name.lastIndexOf('.'));

  if (extension === '.pdf') {
    throw new Error(
      'PDF is not supported, deliberately. Pulling text back out of a PDF garbles '
      + 'spacing and line breaks, so a QA pass on it would report faults that are '
      + 'not in your document and miss ones that are. Check the Word file you '
      + 'made the PDF from.',
    );
  }
  if (extension === '.doc') {
    throw new Error('This is the old Word format. Open it in Word, "Save As" .docx, and try again.');
  }

  if (extension === '.docx' || extension === '.docm') {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { paragraphs, meta } = extractDocx(buffer);
    return documentFromParagraphs(paragraphs, { source: name, format: 'docx', meta });
  }

  const text = await file.text();
  const format = /\.(html?|htm)$/i.test(name) ? 'html' : 'markdown';
  if (format === 'html') {
    return parseMarkdown(htmlToText(text), { source: name, format: 'html' });
  }
  return parseMarkdown(text, { source: name, format: 'markdown' });
}

/** Minimal HTML-to-text, mirroring the CLI's loader. */
function htmlToText(html) {
  let text = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => `\n\n${'#'.repeat(Number(level))} ${body.replace(/<[^>]+>/g, '').trim()}\n\n`);
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => `\n- ${body.replace(/<[^>]+>/g, '').trim()}`);
  text = text.replace(/<\/(p|div|tr|table|ul|ol|section|article|blockquote)>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[body] ?? whole;
  });
}

let lastResult = null;

/** Decide the headline the author actually needs. */
function verdictFor(stats) {
  if (stats.bySeverity.blocker) {
    return {
      tone: 'stop',
      headline: 'Do not send this yet',
      detail: `${stats.bySeverity.blocker} thing${stats.bySeverity.blocker === 1 ? '' : 's'} here must not reach a client.`,
    };
  }
  if (stats.bySeverity.major) {
    return {
      tone: 'warn',
      headline: 'Fix a few things first',
      detail: `${stats.bySeverity.major} item${stats.bySeverity.major === 1 ? '' : 's'} are wrong or read as wrong.`,
    };
  }
  if (stats.total) {
    return { tone: 'ok', headline: 'Good to send', detail: `${stats.total} small point${stats.total === 1 ? '' : 's'} you may want to tidy.` };
  }
  return { tone: 'ok', headline: 'Good to send', detail: 'Nothing mechanical to report.' };
}

function text(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function renderFindings(result, doc) {
  const { stats, findings } = result;
  const verdict = verdictFor(stats);

  const banner = el('verdict');
  banner.className = `verdict ${verdict.tone}`;
  banner.replaceChildren(
    text('strong', null, verdict.headline),
    text('span', null, verdict.detail),
  );

  const dialect = stats.dialect === 'en-GB' ? 'British English'
    : stats.dialect === 'en-US' ? 'American English'
      : 'no clear dialect';
  el('meta').textContent = `${doc.source} - ${stats.words} words, ${stats.headings} headings - reads as ${dialect}`;

  const counts = el('counts');
  counts.replaceChildren(...SEVERITIES.map((severity) => {
    const chip = text('div', `chip ${severity}${stats.bySeverity[severity] ? '' : ' zero'}`);
    chip.append(text('span', 'chip-n', String(stats.bySeverity[severity] || 0)));
    chip.append(text('span', 'chip-l', SEVERITY_LABEL[severity]));
    return chip;
  }));

  const list = el('findings');
  list.replaceChildren();

  if (!findings.length) {
    list.append(text('p', 'empty', 'No mechanical findings. Still read it yourself for argument and accuracy.'));
  }

  for (const severity of SEVERITIES) {
    const group = findings.filter((f) => f.severity === severity);
    if (!group.length) continue;

    const section = text('section', 'group');
    const heading = text('h2', null, `${SEVERITY_LABEL[severity]} (${group.length})`);
    heading.prepend(text('span', `dot ${severity}`));
    section.append(heading);
    section.append(text('p', 'group-blurb', SEVERITY_BLURB[severity]));

    for (const finding of group) {
      const item = text('article', 'finding');
      const where = finding.documentLevel ? 'Whole document' : `Line ${finding.line}`;
      const head = text('div', 'finding-head');
      head.append(text('span', 'where', where));
      head.append(text('span', 'msg', finding.message));
      item.append(head);

      if (finding.excerpt) {
        item.append(text('pre', 'excerpt', finding.excerpt));
      }
      if (finding.suggestion) {
        item.append(text('p', 'suggestion', `Suggested: ${finding.suggestion}`));
      }
      if (finding.note) {
        item.append(text('p', 'note', finding.note));
      }
      const footer = text('p', 'rule');
      footer.textContent = finding.rule + (finding.occurrences > 1 ? ` - ${finding.occurrences} occurrences` : '');
      item.append(footer);
      section.append(item);
    }
    list.append(section);
  }

  el('results').hidden = false;
  el('error').hidden = true;
}

function showError(message) {
  el('error').textContent = message;
  el('error').hidden = false;
  el('results').hidden = true;
}

async function handleFile(file) {
  if (!file) return;
  el('dropzone').classList.remove('dragging');
  el('status').textContent = `Checking ${file.name}...`;

  try {
    const settings = readSettingsFromForm();
    saveSettings(settings);
    const config = buildConfig(settings);
    const doc = await readDocument(file);
    const result = analyse(doc, { config, now: new Date() });
    lastResult = { result, doc };
    renderFindings(result, doc);
    el('status').textContent = '';
  } catch (error) {
    lastResult = null;
    el('status').textContent = '';
    showError(error.message || String(error));
  }
}

function copyReport() {
  if (!lastResult) return;
  const markdown = formatMarkdown(lastResult.result, {
    source: lastResult.doc.source,
    format: lastResult.doc.format,
    now: new Date(),
  });
  const button = el('copy');
  const done = (label) => {
    button.textContent = label;
    setTimeout(() => { button.textContent = 'Copy report'; }, 1800);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(markdown).then(() => done('Copied'), () => fallbackCopy(markdown, done));
  } else {
    fallbackCopy(markdown, done);
  }
}

/** Clipboard API is unavailable on some file:// origins; fall back to a selection. */
function fallbackCopy(value, done) {
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try {
    document.execCommand('copy');
    done('Copied');
  } catch {
    done('Press Ctrl+C');
  }
  area.remove();
}

function init() {
  applySettingsToForm(loadSettings());

  const dropzone = el('dropzone');
  const input = el('file');

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => handleFile(input.files[0]));

  for (const type of ['dragenter', 'dragover']) {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === 'dragleave' && dropzone.contains(event.relatedTarget)) return;
      dropzone.classList.remove('dragging');
    });
  }
  dropzone.addEventListener('drop', (event) => {
    handleFile(event.dataTransfer?.files?.[0]);
  });
  // Dropping anywhere but the target would otherwise navigate away from the page.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());

  el('copy').addEventListener('click', copyReport);
  el('settings-toggle').addEventListener('click', () => {
    const panel = el('settings');
    panel.hidden = !panel.hidden;
    el('settings-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  });
  for (const id of ['dialect', 'clientName', 'otherClients', 'classification']) {
    el(id).addEventListener('change', () => saveSettings(readSettingsFromForm()));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
