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
import { annotatePptx } from '../src/annotate/pptx.mjs';

/** House defaults baked in at build time from report-qa.config.json. */
const BUILT_IN_CONFIG = typeof __HOUSE_CONFIG__ === 'undefined' ? {} : __HOUSE_CONFIG__;

/** Build stamp, so someone can tell whether their copy is the current one. */
const BUILD = typeof __BUILD_INFO__ === 'undefined' ? { date: 'dev', rules: 0 } : __BUILD_INFO__;

const SEVERITY_LABEL = { blocker: 'Blocker', major: 'Major', minor: 'Minor', nit: 'Nit' };
/** Said on the section header, where there is room for a line and no more. */
const SEVERITY_BLURB = {
  blocker: 'Must not reach a client. Fix before the draft leaves the building.',
  major: 'Wrong, or reads as wrong to the client.',
  minor: 'The draft disagrees with itself. Small alone, telling together.',
  nit: 'A preference, not a fault. Fix if you have the time.',
};

/** Read before the words, so the verdict registers without being read. */
const VERDICT_MARK = { stop: '\u2715', warn: '\u0021', ok: '\u2713' };

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

/**
 * Say on the button what these settings are currently doing.
 *
 * Three checks only run when they have been filled in, so leaving them empty
 * quietly narrows the QA pass. The state is on the face of the control rather
 * than behind it, where nobody would look.
 */
function updateSettingsSummary() {
  const settings = readSettingsFromForm();
  const parts = [];
  if (settings.clientName) parts.push(`for ${settings.clientName}`);
  const others = settings.otherClients
    ? settings.otherClients.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  if (others.length) parts.push(`watching ${others.length} other name${others.length === 1 ? '' : 's'}`);
  if (settings.classification) parts.push(settings.classification);

  const state = el('settings-state');
  state.textContent = parts.length ? parts.join(' · ') : 'Not set';
  state.classList.toggle('set', parts.length > 0);
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
    // The bytes travel beside the document, not inside it: the analysis model
    // is shared with the CLI and has no business holding a file buffer.
    return { doc: documentFromParagraphs(paragraphs, { source: name, format: 'pptx', meta }), bytes: buffer };
  }

  if (extension === '.docx' || extension === '.docm') {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { paragraphs, meta } = extractDocx(buffer);
    return { doc: documentFromParagraphs(paragraphs, { source: name, format: 'docx', meta }), bytes: buffer };
  }

  const text = await file.text();
  const format = /\.(html?|htm)$/i.test(name) ? 'html' : 'markdown';
  if (format === 'html') {
    return { doc: parseMarkdown(htmlToText(text), { source: name, format: 'html' }) };
  }
  return { doc: parseMarkdown(text, { source: name, format: 'markdown' }) };
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
  const decoded = text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[body] ?? whole;
  });
  // A browser collapses runs of spaces and ignores indentation, so text pulled
  // out of HTML must too, or every indented line in the source is reported as a
  // double space and a stray blank line.
  return decoded
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

let lastResult = null;

/** Which severity the list is filtered to; 'all' means no filter. */
const view = { filter: 'all' };

/**
 * Findings the reviewer has judged not to apply.
 *
 * Held in memory only, and keyed by the flagged words rather than by a line
 * number, so re-checking the same draft after a round of edits keeps the
 * decisions that are still meaningful. Nothing is written to storage: the keys
 * would carry text out of a client deliverable, and this tool's one promise is
 * that the draft stays in the room.
 */
const ignored = { source: null, rules: new Set(), items: new Set() };

/** Separator for the ignore key: a character no rule id or draft text holds. */
const KEY_SEP = String.fromCharCode(31);
const itemKey = (finding) => `${finding.rule}${KEY_SEP}${matchOf(finding)}`;

function isIgnored(finding) {
  return ignored.rules.has(finding.rule) || ignored.items.has(itemKey(finding));
}

/** Point the ignore list at this draft, keeping it if this is a re-check. */
function resetIgnores(source) {
  if (ignored.source === source) return;
  ignored.source = source;
  ignored.rules.clear();
  ignored.items.clear();
}

/**
 * The result as the reviewer has left it: dismissed findings removed and the
 * counts recomputed, so every count, the verdict and all four exports agree
 * with the list on screen.
 */
function visibleResult() {
  const { result } = lastResult;
  const findings = result.findings.filter((f) => !isIgnored(f));
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const finding of findings) bySeverity[finding.severity] += 1;
  return {
    ...result,
    findings,
    stats: { ...result.stats, total: findings.length, bySeverity },
  };
}

/** Everything dismissed, in the order it was reported. */
function ignoredFindings() {
  return lastResult.result.findings.filter(isIgnored);
}

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
    const n = stats.bySeverity.major;
    return {
      tone: 'warn',
      headline: 'Fix a few things first',
      detail: n === 1 ? '1 item is wrong, or reads as wrong.' : `${n} items are wrong, or read as wrong.`,
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
      group = {
        rule: finding.rule,
        title: finding.title,
        category: finding.category,
        note: finding.note,
        items: [],
      };
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

/** A small control that does not also toggle the group it sits in. */
function actionButton(label, title, onClick) {
  const button = text('button', 'act', label);
  button.type = 'button';
  button.title = title;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
    render();
  });
  return button;
}

/**
 * One place the check fired.
 *
 * Laid out as a grid rather than a flex line: the quote, the replacement and
 * the Ignore button each own their space, so a long quote can no longer push
 * the replacement into the button beside it.
 */
function renderHit(finding) {
  const hit = text('div', 'hit');
  hit.append(text('span', 'where', locationLabel(finding)));
  hit.append(actionButton(
    'Ignore',
    matchOf(finding) ? `Stop reporting "${matchOf(finding)}" for this check` : 'Stop reporting this finding',
    () => ignored.items.add(itemKey(finding)),
  ));

  const parts = finding.excerptParts;
  if (matchOf(finding)) {
    const quote = text('span', 'quote');
    if (parts.before) quote.append(text('span', 'ctx', parts.before));
    quote.append(text('mark', null, parts.match));
    if (parts.after) quote.append(text('span', 'ctx', parts.after));
    hit.append(quote);
  } else {
    // Nothing to quote, so the message is the only thing that says what is wrong.
    hit.append(text('span', 'quote plain', finding.message));
  }

  if (finding.suggestion) {
    const fix = text('p', 'fix');
    fix.append(text('span', null, 'Change to '));
    fix.append(text('code', null, fixLabel(finding.suggestion)));
    hit.append(fix);
  }
  return hit;
}

/** Trim a preview fragment to something that fits on the summary line. */
function shorten(value, limit = 46) {
  const clean = String(value).replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}\u2026` : clean;
}

/**
 * The words a closed card shows, so it can often be judged without opening.
 *
 * A one or two character match - a hyphen, a stray space - says nothing on its
 * own, so those are shown with the word either side of them instead.
 */
function previewOf(group) {
  const seen = [];
  for (const item of group.items) {
    const match = matchOf(item);
    let word;
    if (match.length >= 4) {
      word = match;
    } else if (item.excerptParts) {
      const parts = item.excerptParts;
      const before = parts.before.replace(/^\.\.\./, '').trim().split(/\s+/).slice(-2).join(' ');
      const after = parts.after.replace(/\.\.\.$/, '').trim().split(/\s+/).slice(0, 2).join(' ');
      word = `${before} ${parts.match} ${after}`;
    } else {
      word = item.message;
    }
    word = shorten(word);
    if (word && !seen.includes(word)) seen.push(word);
    if (seen.length === 3) break;
  }
  if (!seen.length) return shorten(group.items[0].message, 90);
  const more = seen.length < group.items.length ? '\u2026' : '';
  return seen.join(' \u00b7 ') + more;
}

/**
 * One check, as one card.
 *
 * Every card collapses the same way, whether the check fired once or eight
 * times, so the list has one rhythm instead of two. Blockers and majors open on
 * arrival because they decide whether the draft can go out; the long tail opens
 * when you ask for it.
 */
function renderCard(group, open) {
  const card = text('details', 'card');
  card.open = open;

  const head = text('summary', 'card-head');
  head.append(text('span', 'caret'));
  head.append(text('span', 'card-title', group.title || group.rule));
  head.append(text('span', 'card-count', String(group.items.length)));
  head.append(actionButton(
    'Ignore check',
    `Stop reporting ${group.title || group.rule} for this draft`,
    () => ignored.rules.add(group.rule),
  ));
  head.append(text('span', 'card-preview', previewOf(group)));
  card.append(head);

  const body = text('div', 'card-body');
  for (const finding of group.items) body.append(renderHit(finding));
  card.append(body);

  // The foot answers "why is this a rule?" and names the family, so the reader
  // never has to decode the rule id - that is only there for `qa-disable`.
  const foot = text('div', 'card-foot');
  if (group.note) foot.append(text('p', null, group.note));
  const provenance = text('p', 'prov');
  if (group.category) {
    provenance.append(text('span', 'rule-family', group.category));
    provenance.append(text('span', null, ' \u00b7 '));
  }
  provenance.append(text('span', 'rule-id', group.rule));
  foot.append(provenance);
  card.append(foot);

  return card;
}

/** The heading over a run of cards. Static: one collapsing layer is enough. */
function severityHead(kind, name, count, blurb, action) {
  const head = text('div', 'sev-head');
  head.append(text('span', `dot ${kind}`));
  head.append(text('span', 'sev-name', name));
  head.append(text('span', 'sev-count', String(count)));
  if (action) head.append(action);
  return [head, text('p', 'sev-blurb', blurb)];
}

/**
 * What the reviewer has set aside, with the way back.
 *
 * Dismissed findings are never simply gone: they stay on the page, counted and
 * one click from returning, because a QA pass whose exclusions are invisible is
 * one nobody can check.
 */
function renderIgnored() {
  const dismissed = ignoredFindings();
  if (!dismissed.length) return null;

  const section = text('section', 'sev ignored');
  section.append(...severityHead(
    'ignored',
    'Ignored',
    dismissed.length,
    'Set aside by you. Left out of every format you copy, and counted so the exclusion is visible.',
    actionButton('Restore all', 'Put every dismissed finding back', () => {
      ignored.rules.clear();
      ignored.items.clear();
    }),
  ));

  for (const group of byRule(dismissed)) {
    const card = text('div', 'card');
    const head = text('div', 'card-head');
    head.append(text('span', 'caret'));
    head.append(text('span', 'card-title', group.title || group.rule));
    head.append(text('span', 'card-count', String(group.items.length)));
    head.append(actionButton('Restore', 'Report this again', () => {
      ignored.rules.delete(group.rule);
      for (const item of group.items) ignored.items.delete(itemKey(item));
    }));
    head.append(text('span', 'card-preview',
      ignored.rules.has(group.rule) ? 'The whole check is ignored for this draft' : previewOf(group)));
    card.append(head);
    section.append(card);
  }
  return section;
}

/** Render the list for whatever severity the reader is currently looking at. */
function renderList(result) {
  const { findings } = result;
  const shown = view.filter === 'all'
    ? findings
    : findings.filter((f) => f.severity === view.filter);

  const list = el('findings');
  list.replaceChildren();

  if (!shown.length) {
    list.append(text('p', 'empty', view.filter === 'all'
      ? 'Nothing left to report. Still read it yourself for argument and accuracy.'
      : `Nothing at this level. Clear the filter to see the other ${findings.length}.`));
  }

  for (const severity of SEVERITIES) {
    const group = shown.filter((f) => f.severity === severity);
    if (!group.length) continue;

    const section = text('section', `sev ${severity}`);
    section.append(...severityHead(
      severity,
      SEVERITY_LABEL[severity],
      group.length,
      SEVERITY_BLURB[severity],
    ));

    // Blockers and majors decide whether the draft can go out, so they arrive
    // open; the long tail arrives shut, or the list is a wall again. Filtering
    // to one severity is a decision to read it, so those open too.
    const open = view.filter !== 'all' || severity === 'blocker' || severity === 'major';
    for (const ruleGroup of byRule(group)) section.append(renderCard(ruleGroup, open));
    list.append(section);
  }

  const dismissed = renderIgnored();
  if (dismissed) list.append(dismissed);

  syncExpandLabel();
}

/** Say what the button will do next, rather than what it did last. */
function syncExpandLabel() {
  const cards = document.querySelectorAll('#findings details.card');
  const anyClosed = [...cards].some((card) => !card.open);
  const button = el('expand');
  button.textContent = anyClosed ? 'Expand all' : 'Collapse all';
  // Nothing to expand is nothing to offer, rather than a control that does nothing.
  button.hidden = cards.length === 0;
}

/** The severity chips double as the filter, which is what "blockers only" means. */
function renderChips(stats) {
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
      render();
    });
    return node;
  };

  counts.replaceChildren(
    chip('all', 'All', stats.total),
    ...SEVERITIES.map((s) => chip(s, SEVERITY_LABEL[s], stats.bySeverity[s] || 0)),
  );
}

/** Redraw everything from the current result and the current ignore list. */
function render() {
  const { doc } = lastResult;
  const result = visibleResult();
  const { stats } = result;
  const dismissed = lastResult.result.findings.length - result.findings.length;
  const verdict = verdictFor(stats);

  const banner = el('verdict');
  banner.className = `verdict ${verdict.tone}`;
  const wording = text('div', 'verdict-words');
  wording.append(text('strong', null, verdict.headline));
  wording.append(text('span', 'detail', verdict.detail));
  const mark = text('span', 'mark', VERDICT_MARK[verdict.tone]);
  mark.setAttribute('aria-hidden', 'true');
  banner.replaceChildren(mark, wording);

  const dialect = stats.dialect === 'en-GB' ? 'British English'
    : stats.dialect === 'en-US' ? 'American English'
      : 'no clear dialect';
  const shape = doc.format === 'pptx'
    ? `${doc.meta.slideCount} slides, ${stats.words} words`
    : `${stats.words} words, ${stats.headings} headings`;
  // The dismissed count rides on the meta line so a verdict reached by ignoring
  // things never looks like a verdict reached by fixing them.
  const aside = dismissed ? ` - ${dismissed} ignored` : '';
  el('meta').textContent = `${doc.source} - ${shape} - reads as ${dialect}${aside}`;

  renderChips(stats);
  renderList(result);

  // Only a deck can carry comments, and only if anything is left to say.
  const deck = doc.format === 'pptx' && lastResult.bytes;
  el('file-actions').hidden = !deck || !result.findings.length;

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
    const { doc, bytes } = await readDocument(file);
    const result = analyse(doc, { config, now: new Date() });
    lastResult = { result, doc, bytes };
    view.filter = 'all';
    resetIgnores(doc.source);
    render();
    // The drop target shrinks to a line once it has done its job, so the
    // findings start near the top of the window instead of below a banner.
    document.body.classList.add('has-result');
    // The settings have done their job by now, and four open fields above the
    // findings is four fields between the reader and what they came for.
    el('settings').hidden = true;
    el('settings-toggle').setAttribute('aria-expanded', 'false');
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
  const result = visibleResult();
  const body = format(result, {
    source: lastResult.doc.source,
    format: lastResult.doc.format,
    now: new Date(),
    dismissed: lastResult.result.findings.length - result.findings.length,
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

/**
 * Save a copy of the deck with every finding written in as a comment.
 *
 * A copy, always. The tool has never modified a draft and this does not start:
 * the bytes that came in are read, a new package is built from them, and the
 * browser is handed that to save under a different name.
 */
function downloadAnnotated() {
  const { doc, bytes } = lastResult;
  const button = el('download-pptx');
  const done = (label) => {
    button.textContent = label;
    setTimeout(() => { button.textContent = 'Download deck with comments'; }, 2400);
  };

  try {
    const annotated = annotatePptx(bytes, visibleResult().findings, { now: new Date() });
    const base = doc.source.replace(/\.[^.]+$/, '');
    const url = URL.createObjectURL(new Blob([annotated], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${base} (QA comments).pptx`;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoked on a later tick so the download has certainly started.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    done('Saved');
  } catch (error) {
    done('Could not write it');
    showError(`The annotated copy could not be written: ${error.message}`);
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
  const saved = loadSettings();
  applySettingsToForm(saved);
  // Opened for a first-time user, so the fields are seen rather than guessed at.
  if (!saved.clientName && !saved.otherClients && !saved.classification) {
    el('settings').hidden = false;
    el('settings-toggle').setAttribute('aria-expanded', 'true');
  }

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
  el('download-pptx').addEventListener('click', downloadAnnotated);

  el('expand').addEventListener('click', () => {
    const cards = document.querySelectorAll('#findings details.card');
    const closed = [...cards].some((card) => !card.open);
    for (const card of cards) card.open = closed;
    syncExpandLabel();
  });
  // A card opened or shut by hand should leave the button telling the truth.
  el('findings').addEventListener('toggle', syncExpandLabel, true);

  // A collapsed group prints as its summary line only, which would silently
  // drop findings from a printed or PDF'd report.
  window.addEventListener('beforeprint', () => {
    for (const card of document.querySelectorAll('#findings details.card')) card.open = true;
  });

  el('settings-toggle').addEventListener('click', () => {
    const panel = el('settings');
    panel.hidden = !panel.hidden;
    el('settings-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  });
  for (const id of ['dialect', 'clientName', 'otherClients', 'classification']) {
    for (const event of ['change', 'input']) {
      el(id).addEventListener(event, () => {
        saveSettings(readSettingsFromForm());
        updateSettingsSummary();
      });
    }
  }
  updateSettingsSummary();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
