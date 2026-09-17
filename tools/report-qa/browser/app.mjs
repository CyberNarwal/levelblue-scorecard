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
import { extractPptx } from '../src/extract/pptx.mjs';
import { formatMarkdown, formatComments, formatSummaryDocument, formatBlockersOnly } from '../src/report.mjs';

/** House defaults baked in at build time from report-qa.config.json. */
const BUILT_IN_CONFIG = typeof __HOUSE_CONFIG__ === 'undefined' ? {} : __HOUSE_CONFIG__;

/** Build stamp, so someone can tell whether their copy is the current one. */
const BUILD = typeof __BUILD_INFO__ === 'undefined' ? { date: 'dev', rules: 0 } : __BUILD_INFO__;

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

  if (extension === '.ppt') {
    throw new Error('This is the old PowerPoint format. Open it, "Save As" .pptx, and try again.');
  }

  if (extension === '.pptx' || extension === '.pptm' || extension === '.potx') {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { paragraphs, meta } = extractPptx(buffer);
    return documentFromParagraphs(paragraphs, { source: name, format: 'pptx', meta });
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

/** Which severity the list is filtered to; 'all' means no filter. */
const view = { filter: 'all' };

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

/** Where the reader should look in their own draft. */
function locationLabel(finding) {
  if (finding.documentLevel) return 'File';
  if (finding.slide) return `Slide ${finding.slide}${finding.region === 'notes' ? ' notes' : ''}`;
  return `Line ${finding.line}`;
}

/** The flagged words, normalised for comparison and for a collapsed preview. */
function matchOf(finding) {
  return finding.excerptParts?.match?.replace(/\s+/g, ' ').trim() || '';
}

/**
 * Gather a severity's findings by the rule that raised them.
 *
 * One rule firing eight times was eight rows repeating the same explanation,
 * which is most of what made a long report unreadable. As one row carrying a
 * count it is a single decision, and the eight places are a click away.
 */
function byRule(findings) {
  const groups = new Map();
  for (const finding of findings) {
    let group = groups.get(finding.rule);
    if (!group) {
      group = { rule: finding.rule, title: finding.title, note: finding.note, items: [] };
      groups.set(finding.rule, group);
    }
    group.items.push(finding);
  }
  return [...groups.values()];
}

/** A whitespace-only replacement has to be quoted or it renders as nothing. */
function fixLabel(suggestion) {
  return /^\s*$/.test(suggestion) ? `"${suggestion}"` : suggestion;
}

/** One place the rule fired: where it is, the draft's words, the replacement. */
function renderOccurrence(finding) {
  const row = text('div', 'row');
  row.append(text('span', 'where', locationLabel(finding)));

  const match = matchOf(finding);
  if (match) {
    const parts = finding.excerptParts;
    const quote = text('span', 'quote');
    if (parts.before) quote.append(text('span', 'ctx', parts.before));
    quote.append(text('mark', null, parts.match));
    if (parts.after) quote.append(text('span', 'ctx', parts.after));
    row.append(quote);
  } else {
    // Nothing to quote, so the message is the only thing that says what is wrong.
    row.append(text('span', 'quote plain', finding.message));
  }

  if (finding.suggestion) row.append(text('span', 'fix', `→ ${fixLabel(finding.suggestion)}`));
  return row;
}

/**
 * One rule's findings. A rule that fired once is a plain block; one that fired
 * repeatedly collapses, with the flagged words on the summary line so the group
 * can often be judged without opening it.
 */
function renderRuleGroup(group) {
  const many = group.items.length > 1;
  const box = text(many ? 'details' : 'div', 'rule-group');
  const head = text(many ? 'summary' : 'div', 'rule-head');

  head.append(text('span', 'rule-title', group.title || group.rule));
  head.append(text('span', 'count', String(group.items.length)));

  if (many) {
    const words = [];
    for (const item of group.items) {
      const match = matchOf(item);
      if (match && !words.includes(match)) words.push(match);
      if (words.length === 4) break;
    }
    if (words.length) {
      const more = words.length < group.items.length ? '…' : '';
      head.append(text('span', 'preview', words.join(', ') + more));
    }
  }
  box.append(head);

  const body = text('div', 'rule-body');
  for (const finding of group.items) body.append(renderOccurrence(finding));
  if (group.note) body.append(text('p', 'note', group.note));
  body.append(text('p', 'rule', group.rule));
  box.append(body);

  return box;
}

/** Render the list for whatever severity the reader is currently looking at. */
function renderList() {
  const { findings } = lastResult.result;
  const shown = view.filter === 'all'
    ? findings
    : findings.filter((f) => f.severity === view.filter);

  const list = el('findings');
  list.replaceChildren();

  if (!shown.length) {
    list.append(text('p', 'empty', view.filter === 'all'
      ? 'No mechanical findings. Still read it yourself for argument and accuracy.'
      : `Nothing at this level. Clear the filter to see the other ${findings.length}.`));
    return;
  }

  for (const severity of SEVERITIES) {
    const group = shown.filter((f) => f.severity === severity);
    if (!group.length) continue;

    const section = text('details', `sev ${severity}`);
    // Blockers and majors decide whether the draft can go out, so they start
    // open; the long tail starts shut or the list is a wall again.
    section.open = view.filter !== 'all' || severity === 'blocker' || severity === 'major';

    const heading = text('summary', 'sev-head');
    heading.append(text('span', `dot ${severity}`));
    heading.append(text('span', 'sev-name', SEVERITY_LABEL[severity]));
    heading.append(text('span', 'count', String(group.length)));
    heading.append(text('span', 'sev-blurb', SEVERITY_BLURB[severity]));
    section.append(heading);

    const body = text('div', 'sev-body');
    for (const ruleGroup of byRule(group)) body.append(renderRuleGroup(ruleGroup));
    section.append(body);
    list.append(section);
  }
}

/** The severity chips double as the filter, which is what "blockers only" means. */
function renderChips() {
  const { stats } = lastResult.result;
  const counts = el('counts');
  const chip = (key, label, n) => {
    const node = text('button', `chip ${key}${n ? '' : ' zero'}${view.filter === key ? ' on' : ''}`);
    node.type = 'button';
    node.disabled = !n;
    node.setAttribute('aria-pressed', String(view.filter === key));
    node.append(text('span', 'chip-n', String(n)));
    node.append(text('span', 'chip-l', label));
    node.addEventListener('click', () => {
      view.filter = view.filter === key ? 'all' : key;
      renderChips();
      renderList();
    });
    return node;
  };

  counts.replaceChildren(
    chip('all', 'All', stats.total),
    ...SEVERITIES.map((s) => chip(s, SEVERITY_LABEL[s], stats.bySeverity[s] || 0)),
  );
}

function renderFindings(result, doc) {
  const { stats } = result;
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
  const shape = doc.format === 'pptx'
    ? `${doc.meta.slideCount} slides, ${stats.words} words`
    : `${stats.words} words, ${stats.headings} headings`;
  el('meta').textContent = `${doc.source} - ${shape} - reads as ${dialect}`;

  renderChips();
  renderList();

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
    view.filter = 'all';
    renderFindings(result, doc);
    // The drop target shrinks to a line once it has done its job, so the
    // findings start near the top of the window instead of below a banner.
    document.body.classList.add('has-result');
    el('drop-title').textContent = `Checked ${file.name}`;
    el('drop-hint').textContent = 'Drop another draft, or click to choose';
    el('status').textContent = '';
  } catch (error) {
    lastResult = null;
    el('status').textContent = '';
    showError(error.message || String(error));
  }
}

/** The hand-off formats, by the id of the button that copies each one. */
const EXPORTS = {
  'copy-comments': { label: 'For comments', format: formatComments },
  'copy-summary': { label: 'Summary', format: formatSummaryDocument },
  'copy-blockers': { label: 'Blocker list', format: formatBlockersOnly },
  'copy-report': { label: 'Full report', format: formatMarkdown },
};

function copyExport(id) {
  if (!lastResult) return;
  const { label, format } = EXPORTS[id];
  const body = format(lastResult.result, {
    source: lastResult.doc.source,
    format: lastResult.doc.format,
    now: new Date(),
  });

  const button = el(id);
  const done = (result) => {
    button.textContent = result;
    setTimeout(() => { button.textContent = label; }, 1800);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(body).then(() => done('Copied'), () => fallbackCopy(body, done));
  } else {
    fallbackCopy(body, done);
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

  const version = el('version');
  if (version) {
    version.textContent = `Version ${BUILD.date}${BUILD.commit ? ` (${BUILD.commit})` : ''} - ${BUILD.rules} checks`;
  }

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

  for (const id of Object.keys(EXPORTS)) {
    el(id).addEventListener('click', () => copyExport(id));
  }

  el('expand').addEventListener('click', () => {
    const groups = document.querySelectorAll('#findings details');
    const closed = [...groups].some((d) => !d.open);
    for (const group of groups) group.open = closed;
    el('expand').textContent = closed ? 'Collapse all' : 'Expand all';
  });

  // A collapsed group prints as its summary line only, which would silently
  // drop findings from a printed or PDF'd report.
  window.addEventListener('beforeprint', () => {
    for (const group of document.querySelectorAll('#findings details')) group.open = true;
  });

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
