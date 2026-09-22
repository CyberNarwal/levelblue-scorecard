/**
 * Build the team walkthrough deck for the offline QA page.
 *
 * The check counts come from the rules themselves, for the same reason the
 * handbook's do: a deck that disagrees with the tool undermines the tool.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pptxgen from 'pptxgenjs';

import { ALL_RULES } from '../src/engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', '..', 'Report QA - team walkthrough.pptx');

// The tool's own colours: the severity palette is the subject matter, so the
// deck uses exactly what the team sees on screen rather than a deck palette.
const NAVY = '0A1929';
const NAVY_SOFT = '16293D';
const WHITE = 'FFFFFF';
const PANEL = 'F4F7FC';
const INK = '0B1622';
const MUTED = '5C6B7F';
const RULE = 'DCE4EF';
const BLUE = '0052FF';
const GREEN = '1A7F52';
const GREEN_SOFT = 'E7F5EE';
const BLOCKER = 'B3261E';
const MAJOR = 'B45309';
const NIT = '5A6C7D';
// The flagged-text highlight is the tool's signature mark, so it is the motif.
const MARK = 'FFE28A';
const MARK_INK = '4A3300';

const HEAD = 'Cambria';
const BODY = 'Calibri';

const W = 13.333;
const M = 0.62;
const CW = W - M * 2;

const counts = { blocker: 0, major: 0, minor: 0, nit: 0 };
for (const rule of ALL_RULES) counts[rule.severity] += 1;
const families = new Map();
for (const rule of ALL_RULES) families.set(rule.category, (families.get(rule.category) ?? 0) + 1);
const familyList = [...families.entries()].sort((a, b) => b[1] - a[1]);

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';

/**
 * Every slide gets a real title placeholder rather than a text box that merely
 * looks like one. Without it the slide has no title in PowerPoint's outline
 * view and a screen reader announces the deck as fourteen untitled slides -
 * which is also what the QA tool reports, on its own deck.
 */
for (const [name, y, colour, bg] of [
  ['TITLE', 1.95, 'FFFFFF', NAVY],
  ['CONTENT', 0.52, INK, WHITE],
  ['DARK', 0.72, 'FFFFFF', NAVY],
]) {
  pres.defineSlideMaster({
    title: name,
    background: { color: bg },
    objects: [{
      placeholder: {
        options: {
          name: 'title',
          type: 'title',
          x: M, y, w: CW, h: name === 'TITLE' ? 1.15 : name === 'DARK' ? 0.66 : 0.62,
          fontFace: HEAD, fontSize: name === 'TITLE' ? 60 : name === 'DARK' ? 34 : 34,
          bold: true, color: colour, valign: 'middle', margin: 0,
        },
        text: '',
      },
    }],
  });
}
pres.author = 'Rajan Narwal';
pres.company = 'LevelBlue';
pres.title = 'Report QA - team walkthrough';

/** A slide title, in the one place every content slide puts it. */
function title(slide, text, sub) {
  slide.addText(text, { placeholder: 'title' });
  if (sub) {
    slide.addText(sub, {
      x: M, y: 1.16, w: CW, h: 0.36,
      fontFace: BODY, fontSize: 15, color: MUTED,
      isTextBox: true, margin: 0, valign: 'middle',
    });
  }
}

/** A severity chip, in the tool's own vocabulary. */
function pill(slide, label, colour, bg, x, y, w = 1.15) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h: 0.32, fill: { color: bg }, line: { color: bg }, rectRadius: 0.16,
  });
  slide.addText(label.toUpperCase(), {
    x, y, w, h: 0.32,
    fontFace: BODY, fontSize: 10.5, bold: true, color: colour, charSpacing: 0.6,
    align: 'center', valign: 'middle', isTextBox: true, margin: 0,
  });
}

const shotMeta = Object.fromEntries(
  JSON.parse(readFileSync(join(here, 'shots', 'sizes.json'), 'utf8')).map((m) => [m.name, m]),
);

/**
 * Place a screenshot of the real tool, sized from its own pixel dimensions so
 * the interface is never stretched into something the team would not recognise.
 * Returns the height used, so the caller can lay out beneath it.
 */
function picture(slide, name, x, y, w) {
  const meta = shotMeta[name];
  if (!meta) throw new Error(`no screenshot captured for "${name}" - run capture.mjs`);
  const data = readFileSync(join(here, 'shots', `${name}.png`)).toString('base64');
  const h = (w * meta.h) / meta.w;
  slide.addShape(pres.ShapeType.roundRect, {
    x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12,
    fill: { color: WHITE }, line: { color: RULE, width: 1 }, rectRadius: 0.06,
  });
  slide.addImage({ data: `image/png;base64,${data}`, x, y, w, h });
  return h;
}

function caption(slide, text, x, y, w) {
  slide.addText(text, {
    x, y, w, h: 0.26,
    fontFace: BODY, fontSize: 11, color: '8A9AAC', italic: true,
    isTextBox: true, margin: 0, valign: 'middle',
  });
}

function card(slide, x, y, w, h, fill = WHITE) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, fill: { color: fill }, line: { color: RULE, width: 1 }, rectRadius: 0.07,
  });
}

// ---------------------------------------------------------------- 1. title

{
  const s = pres.addSlide({ masterName: 'TITLE' });
  s.addText('LEVELBLUE · CYBER ADVISORY', {
    x: M, y: 1.55, w: CW, h: 0.3,
    fontFace: BODY, fontSize: 12.5, bold: true, color: '7FA8FF', charSpacing: 2.2,
    isTextBox: true, margin: 0,
  });
  s.addText('Report QA', { placeholder: 'title' });
  s.addText([
    { text: 'The mechanical check that runs before ', options: { color: 'B9C9DD' } },
    { text: 'you', options: { color: MARK_INK, highlight: MARK, bold: true } },
    { text: ' read the draft.', options: { color: 'B9C9DD' } },
  ], {
    x: M, y: 3.18, w: 9.4, h: 0.44,
    fontFace: BODY, fontSize: 20, isTextBox: true, margin: 0, valign: 'middle',
  });
  s.addText(
    `${ALL_RULES.length} checks · one file · no install · nothing leaves your computer`,
    {
      x: M, y: 4.05, w: CW, h: 0.34,
      fontFace: BODY, fontSize: 14, color: '8FA6C0', isTextBox: true, margin: 0,
    },
  );
  s.addText('Rajan Narwal · Manager, Cyber Advisory', {
    x: M, y: 6.35, w: CW, h: 0.3,
    fontFace: BODY, fontSize: 12.5, color: '6F87A3', isTextBox: true, margin: 0,
  });
  s.addNotes('A walkthrough of the offline Report QA tool: what it is, what it is not, and how to use it. Two things matter most – it is the first of two review stages, and no client data leaves the machine.');
}

// ------------------------------------------------- 2. the two things first

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'Two things before anything else', 'Everything else in this deck is detail. These two are not.');

  const cardW = (CW - 0.45) / 2;
  card(s, M, 1.75, cardW, 4.3);
  s.addShape(pres.ShapeType.roundRect, {
    x: M + 0.42, y: 2.1, w: 0.46, h: 0.46, fill: { color: 'E8EFFF' }, line: { color: 'E8EFFF' }, rectRadius: 0.23,
  });
  s.addText('1', {
    x: M + 0.42, y: 2.1, w: 0.46, h: 0.46,
    fontFace: HEAD, fontSize: 19, bold: true, color: BLUE, align: 'center', valign: 'middle', isTextBox: true, margin: 0,
  });
  s.addText('It is stage one, not the review', {
    x: M + 0.42, y: 2.78, w: cardW - 0.84, h: 0.94,
    fontFace: HEAD, fontSize: 25, bold: true, color: INK, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05,
  });
  s.addText(
    'It finds mechanical faults. It cannot tell you whether a finding is right, whether a severity is justified, or whether your advice would work.\n\nA clean result is not sign-off. Every draft still needs someone to read it.',
    {
      x: M + 0.42, y: 3.86, w: cardW - 0.84, h: 1.85,
      fontFace: BODY, fontSize: 14.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.18,
    },
  );

  const x2 = M + cardW + 0.45;
  card(s, x2, 1.75, cardW, 4.3);
  s.addShape(pres.ShapeType.roundRect, {
    x: x2 + 0.42, y: 2.1, w: 0.46, h: 0.46, fill: { color: GREEN_SOFT }, line: { color: GREEN_SOFT }, rectRadius: 0.23,
  });
  s.addText('2', {
    x: x2 + 0.42, y: 2.1, w: 0.46, h: 0.46,
    fontFace: HEAD, fontSize: 19, bold: true, color: GREEN, align: 'center', valign: 'middle', isTextBox: true, margin: 0,
  });
  s.addText('Nothing leaves your computer', {
    x: x2 + 0.42, y: 2.78, w: cardW - 0.84, h: 0.94,
    fontFace: HEAD, fontSize: 25, bold: true, color: INK, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05,
  });
  s.addText(
    'No upload, no server, no account, no telemetry. The draft is read into your browser and forgotten when you close the tab.\n\nYou can prove it: pull the network cable, open the file, check a report. It works the same.',
    {
      x: x2 + 0.42, y: 3.86, w: cardW - 0.84, h: 1.85,
      fontFace: BODY, fontSize: 14.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.18,
    },
  );
  s.addNotes('If people remember nothing else from this session, it should be these two. The first protects the client from a bad report; the second protects the client from us.');
}

// --------------------------------------------------------- 3. how it runs

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'How it runs', 'One file. No install, no terminal, no server, no network.');

  const rows = [
    ['Save the file', 'report-qa.html goes wherever you keep it - SharePoint, your desktop, a USB stick. Open it in Edge or Chrome.'],
    ['It runs locally', 'Everything it needs is inside that one file. Your browser runs it locally, and makes no request – so there is nowhere for the draft to go.'],
    ['Updating is a file swap', 'Replace the one file and everyone picks up the new checks. The version is printed at the foot of the tool.'],
  ];
  let y = 1.82;
  for (const [head, text] of rows) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y + 0.04, w: 0.42, h: 0.42, fill: { color: 'E8EFFF' }, line: { color: 'E8EFFF' }, rectRadius: 0.21,
    });
    s.addText('>', {
      x: M, y: y + 0.04, w: 0.42, h: 0.42,
      fontFace: BODY, fontSize: 15, bold: true, color: BLUE, align: 'center', valign: 'middle', isTextBox: true, margin: 0,
    });
    s.addText(head, {
      x: M + 0.66, y, w: 3.6, h: 0.42,
      fontFace: HEAD, fontSize: 18, bold: true, color: INK, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(text, {
      x: M + 4.36, y: y - 0.02, w: CW - 4.36, h: 1.1,
      fontFace: BODY, fontSize: 14, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.16,
    });
    y += 1.42;
  }

  card(s, M, 6.06, CW, 0.82, PANEL);
  s.addText([
    { text: 'Enforced, not promised.  ', options: { bold: true, color: INK } },
    { text: 'The build refuses to produce a file containing a network call or an external script. If someone added one, the build fails rather than ships.', options: { color: MUTED } },
  ], {
    x: M + 0.34, y: 6.06, w: CW - 0.68, h: 0.82,
    fontFace: BODY, fontSize: 13.5, isTextBox: true, margin: 0, valign: 'middle',
  });
  s.addNotes('The offline guarantee is checked by the build script, not left to anyone remembering. Worth saying out loud to anyone nervous about putting client drafts through a browser page.');
}

// -------------------------------------------------- 4. engagement settings

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'Set the engagement first', 'Four values. Three checks cannot run without them, so an empty field quietly narrows the whole pass.');

  const head = ['Setting', 'What it unlocks', 'If you leave it blank'];
  const rows = [
    ['English', 'Holds the report to British or American spelling.', 'The dialect is guessed – unreliable on a short deck.'],
    ["This client's name", 'Checks the report actually names them.', 'A template field nobody filled in goes unnoticed.'],
    ["Other clients' names", 'Catches a previous client surviving in a copied deck, including the slide masters.', 'Template leakage goes unreported – the worst thing this tool finds.'],
    ['Required marking', 'Checks the classification marking is present and consistent.', 'The marking is not checked at all.'],
  ];
  const colW = [2.85, 4.6, CW - 2.85 - 4.6];
  let y = 1.92;
  let x = M;
  head.forEach((h, i) => {
    s.addText(h.toUpperCase(), {
      x, y, w: colW[i], h: 0.34,
      fontFace: BODY, fontSize: 10.5, bold: true, color: MUTED, charSpacing: 1.1,
      isTextBox: true, margin: 0, valign: 'middle',
    });
    x += colW[i];
  });
  y += 0.4;
  s.addShape(pres.ShapeType.line, { x: M, y, w: CW, h: 0, line: { color: RULE, width: 1 } });
  y += 0.16;

  for (const row of rows) {
    x = M;
    row.forEach((cell, i) => {
      s.addText(cell, {
        x, y, w: colW[i] - 0.3, h: 0.74,
        fontFace: BODY, fontSize: 13.5,
        bold: i === 0, color: i === 0 ? INK : MUTED,
        isTextBox: true, margin: 0, lineSpacingMultiple: 1.14,
      });
      x += colW[i];
    });
    y += 0.80;
  }

  const h4 = picture(s, 'settings', M, 5.88, 8.6);
  caption(s, 'The button carries its own state.', M + 8.95, 5.88 + h4 / 2 - 0.13, 3.1);
  s.addNotes('Real example: filling these in on our sample deck took it from 27 findings to 29, and the two it added were a missing classification marking and a previous client name sitting in the slide master – invisible to anyone reading the slides.');
}

// ------------------------------------------------------ 5. running a check

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'Running a check', 'Five steps. The last one is the one the tool cannot do for you.');

  const steps = [
    ['Drop the draft on the page', 'PowerPoint, Word, Markdown or HTML. Nothing is uploaded.'],
    ['Read the verdict', 'One line: whether anything here must not reach a client.'],
    ['Work the blockers and majors', 'They open by default. Minors and nits start collapsed.'],
    ['Set aside what does not apply', 'Counts, verdict and every export follow your decisions.'],
    ['Hand it back, then read it yourself', 'This is the judgement the tool has no access to.'],
  ];
  let y = 1.92;
  steps.forEach(([head, sub], i) => {
    const last = i === steps.length - 1;
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: 0.5, h: 0.5,
      fill: { color: last ? BLUE : 'E8EFFF' }, line: { color: last ? BLUE : 'E8EFFF' }, rectRadius: 0.25,
    });
    s.addText(String(i + 1), {
      x: M, y, w: 0.5, h: 0.5,
      fontFace: HEAD, fontSize: 17, bold: true, color: last ? WHITE : BLUE,
      align: 'center', valign: 'middle', isTextBox: true, margin: 0,
    });
    s.addText(head, {
      x: M + 0.78, y: y - 0.04, w: 5.3, h: 0.32,
      fontFace: HEAD, fontSize: 18, bold: true, color: INK, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(sub, {
      x: M + 0.78, y: y + 0.31, w: 5.9, h: 0.32,
      fontFace: BODY, fontSize: 13.5, color: MUTED, isTextBox: true, margin: 0, valign: 'middle',
    });
    y += 0.94;
  });

  const h5 = picture(s, 'verdict', M + 7.1, 2.15, 4.99);
  caption(s, 'Step 2, on a real deck.', M + 7.1, 2.15 + h5 + 0.16, 4.99);
  s.addNotes('Step five is the point of the whole thing. The tool exists to clear the mechanical noise so that read is spent on argument and accuracy.');
}

// ---------------------------------------------------------- 6. the levels

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'The four levels', 'What each one is telling you to do.');

  const levels = [
    ['Blocker', counts.blocker, BLOCKER, 'FDECEA', 'Must not reach a client at all.',
      'A credential, another client’s name, an unresolved comment, a tracked change, an internal remark in the speaker notes.'],
    ['Major', counts.major, MAJOR, 'FDF3E3', 'Wrong, or reads as wrong to the client.',
      'A missing section, a cross-reference that goes nowhere, a Common Vulnerability Scoring System (CVSS) score that contradicts its own label.'],
    ['Minor', counts.minor, BLUE, 'EEF4FF', 'The draft disagrees with itself.',
      'Spelling, capitalisation, dashes, spacing. Small alone; together they are what makes a report look unchecked.'],
    ['Nit', counts.nit, NIT, 'EEF1F5', 'A preference rather than a fault.',
      'Wordiness, hedging, passive voice. Fix if you have the time, ignore it if you do not.'],
  ];
  let y = 1.86;
  for (const [name, n, colour, bg, gist, detail] of levels) {
    card(s, M, y, CW, 1.15);
    pill(s, name, colour, bg, M + 0.32, y + 0.24);
    s.addText(`${n} checks`, {
      x: M + 0.32, y: y + 0.63, w: 1.15, h: 0.26,
      fontFace: BODY, fontSize: 10.5, color: MUTED, align: 'center', isTextBox: true, margin: 0,
    });
    s.addText(gist, {
      x: M + 1.72, y: y + 0.2, w: CW - 2.1, h: 0.34,
      fontFace: HEAD, fontSize: 16.5, bold: true, color: INK, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(detail, {
      x: M + 1.72, y: y + 0.56, w: CW - 2.1, h: 0.46,
      fontFace: BODY, fontSize: 13, color: MUTED, isTextBox: true, margin: 0, valign: 'top',
    });
    y += 1.27;
  }
  s.addNotes('Blockers and majors decide whether the draft goes out. Minors and nits are about how finished it looks.');
}

// --------------------------------------------- 7. anatomy of a finding

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'Every finding quotes your own words', 'So you can match it against the slide in front of you, instead of decoding a rule name.');

  const shotH = picture(s, 'finding', M, 1.9, CW);
  caption(s, 'The tool, on our sample deck.', M, 1.9 + shotH + 0.16, CW);

  const notes = [
    ['The exact words', 'Highlighted inside their own sentence – not a line number to go hunting with.'],
    ['Whitespace too', 'A double space shows as a highlighted blank. It is the only way to see one at all.'],
    ['The replacement', 'Where the fix is unambiguous, it is given in green on the right.'],
    ['The family', 'Which kind of check raised it, and the rule name if you need to raise it with me.'],
  ];
  const colW = (CW - 0.4) / 2;
  notes.forEach(([head, text], i) => {
    const x = M + (i % 2) * (colW + 0.4);
    const y = 4.45 + Math.floor(i / 2) * 1.2;
    s.addText(head, {
      x, y, w: colW, h: 0.3,
      fontFace: HEAD, fontSize: 15.5, bold: true, color: INK, isTextBox: true, margin: 0,
    });
    s.addText(text, {
      x, y: y + 0.32, w: colW, h: 0.62,
      fontFace: BODY, fontSize: 13, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.14,
    });
  });
  s.addNotes('This was the single biggest change to the tool: the finding used to say what rule fired and roughly where. Now it shows the words at fault, highlighted, in context.');
}

// ------------------------------------------------------- 8. reading the list

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'Keeping the list readable', 'A 27-finding deck used to be three screens. It is now about one.');

  const blocks = [
    ['Grouped by check', 'A check that fired eight times is one row with a count and a preview of the flagged words – often enough to act on without opening it.'],
    ['Collapsed by default', 'Blockers and majors open, because they decide whether the draft goes out. Minors and nits start shut.'],
    ['Show filters the list', 'Click Blocker and you see blockers only. Click it again to clear. That is your go/no-go view.'],
  ];
  const cardW = (CW - 0.8) / 3;
  blocks.forEach(([head, text], i) => {
    const x = M + i * (cardW + 0.4);
    card(s, x, 1.95, cardW, 2.5);
    s.addText(head, {
      x: x + 0.3, y: 2.25, w: cardW - 0.6, h: 0.64,
      fontFace: HEAD, fontSize: 18, bold: true, color: INK, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05,
    });
    s.addText(text, {
      x: x + 0.3, y: 2.95, w: cardW - 0.6, h: 1.3,
      fontFace: BODY, fontSize: 13.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.16,
    });
  });

  const h8 = picture(s, 'grouped', M, 4.95, CW);
  caption(s, 'One row, six places. Often enough to judge without opening it.', M, 4.95 + h8 + 0.18, CW);

  s.addNotes('The preview on a collapsed group is the useful part – the flagged words themselves, so you can often decide without expanding.');
}

// ------------------------------------------------------ 9. ignoring findings

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'You have the last word', 'No rule set is right about everything.');

  const cardW = (CW - 0.45) / 2;
  card(s, M, 1.9, cardW, 1.62);
  s.addText('Ignore', {
    x: M + 0.34, y: 2.12, w: cardW - 0.68, h: 0.34,
    fontFace: HEAD, fontSize: 19, bold: true, color: INK, isTextBox: true, margin: 0,
  });
  s.addText('Stops that flagged text being reported by that check.', {
    x: M + 0.34, y: 2.52, w: cardW - 0.68, h: 0.76,
    fontFace: BODY, fontSize: 14, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.14,
  });

  const x2 = M + cardW + 0.45;
  card(s, x2, 1.9, cardW, 1.62);
  s.addText('Ignore check', {
    x: x2 + 0.34, y: 2.12, w: cardW - 0.68, h: 0.34,
    fontFace: HEAD, fontSize: 19, bold: true, color: INK, isTextBox: true, margin: 0,
  });
  s.addText('Sets the whole check aside for this draft.', {
    x: x2 + 0.34, y: 2.52, w: cardW - 0.68, h: 0.76,
    fontFace: BODY, fontSize: 14, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.14,
  });

  s.addText('Nothing you set aside is simply gone', {
    x: M, y: 3.78, w: CW, h: 0.4,
    fontFace: HEAD, fontSize: 21, bold: true, color: INK, isTextBox: true, margin: 0, valign: 'middle',
  });
  const facts = [
    'It collects in an Ignored section at the foot of the list, with Restore on each.',
    'The running total sits under the verdict, so a verdict reached by ignoring never looks like one reached by fixing.',
    'Every copied format states how many were left out.',
    'Your decisions survive re-checking the same draft after a round of edits – but are never written to disk, because the keys would carry client text into browser storage.',
  ];
  s.addText(facts.map((t, i) => ({
    text: t,
    options: { bullet: true, breakLine: i !== facts.length - 1 },
  })), {
    x: M + 0.1, y: 4.28, w: CW - 0.2, h: 1.27,
    fontFace: BODY, fontSize: 13.5, color: MUTED, isTextBox: true, margin: 0, paraSpaceAfter: 5,
  });

  picture(s, 'ignored', M + 0.34, 5.66, 11.4);
  s.addNotes('The point is that exclusions are visible. A QA pass whose exclusions are invisible is one nobody can audit – including us, six months later.');
}

// ------------------------------------------------- 10. handing findings back

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'Handing the findings back', 'Copy puts them on your clipboard in the shape the next person needs.');

  const items = [
    ['For comments', 'One block per finding, to paste into the comment on that slide or paragraph.'],
    ['Summary', 'One line per finding, blockers first, to attach to the mail back to the author.'],
    ['Blocker list', 'Only what stops the draft being issued. The go/no-go note.'],
    ['Full report', 'The complete report in Markdown, for a review thread.'],
  ];
  const cardW = (CW - 0.45) / 2;
  items.forEach(([head, text], i) => {
    const x = M + (i % 2) * (cardW + 0.45);
    const y = 1.92 + Math.floor(i / 2) * 1.5;
    card(s, x, y, cardW, 1.28);
    s.addText(head, {
      x: x + 0.32, y: y + 0.2, w: cardW - 0.64, h: 0.32,
      fontFace: HEAD, fontSize: 17, bold: true, color: BLUE, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(text, {
      x: x + 0.32, y: y + 0.56, w: cardW - 0.64, h: 0.58,
      fontFace: BODY, fontSize: 13.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.12,
    });
  });

  const h10 = picture(s, 'handoff', M + 0.74, 4.90, 10.6);
  card(s, M, 4.90 + h10 + 0.2, CW, 0.7, PANEL);
  s.addText([
    { text: 'All four quote the flagged text. ', options: { bold: true, color: INK } },
    { text: '"Line 42 has an American spelling" sends the author hunting. ', options: { color: MUTED } },
    { text: 'Found: "color"', options: { highlight: MARK, color: MARK_INK } },
    { text: ' does not.', options: { color: MUTED } },
  ], {
    x: M + 0.36, y: 4.90 + h10 + 0.2, w: CW - 0.72, h: 0.7,
    fontFace: BODY, fontSize: 13.5, isTextBox: true, margin: 0, valign: 'middle',
  });
  s.addNotes('Anything you set aside is excluded from all four, and each one states how many were left out.');
}

// ------------------------------------------ 11. comments into the deck

{
  const s = pres.addSlide({ masterName: 'DARK' });
  s.addText('No more transcribing', { placeholder: 'title' });
  s.addText('For a PowerPoint file, Download deck with comments saves a copy carrying one real PowerPoint comment per finding, on the slide it came from.', {
    x: M, y: 1.42, w: 10.6, h: 0.7,
    fontFace: BODY, fontSize: 16, color: 'B9C9DD', isTextBox: true, margin: 0, lineSpacingMultiple: 1.15,
  });

  const points = [
    ['It writes a copy', 'Deck (QA comments).pptx. The file you dropped in is read and never written to.'],
    ['Slides are untouched', 'Copied across byte for byte. Nothing is re-encoded behind the author’s back.'],
    ['Existing comments survive', 'Yours and anyone else’s, with their names. A second pass adds rather than replaces.'],
    ['Ignored findings stay out', 'The same as the copied formats.'],
  ];
  let y = 2.42;
  for (const [head, text] of points) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y + 0.06, w: 0.34, h: 0.34, fill: { color: NAVY_SOFT }, line: { color: NAVY_SOFT }, rectRadius: 0.17,
    });
    s.addText('✓', {
      x: M, y: y + 0.06, w: 0.34, h: 0.34,
      fontFace: BODY, fontSize: 13, bold: true, color: '6DDBA4', align: 'center', valign: 'middle', isTextBox: true, margin: 0,
    });
    s.addText(head, {
      x: M + 0.56, y, w: 3.5, h: 0.44,
      fontFace: HEAD, fontSize: 17, bold: true, color: WHITE, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(text, {
      x: M + 4.2, y, w: CW - 4.2, h: 0.44,
      fontFace: BODY, fontSize: 13.5, color: '9FB4CC', isTextBox: true, margin: 0, valign: 'middle',
    });
    y += 0.84;
  }
  s.addText('Word is not supported for this yet – it anchors comments to exact runs of text rather than to a page, which is a harder problem.', {
    x: M, y: 6.25, w: CW, h: 0.4,
    fontFace: BODY, fontSize: 12.5, color: '7B92AC', italic: true, isTextBox: true, margin: 0, valign: 'middle',
  });
  s.addNotes('This is the step that used to cost the most time – reading a QA report and retyping each point into the deck as a comment.');
}

// --------------------------------------------------------- 12. what it reads

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, 'What it reads', 'And the one format it refuses, on purpose.');

  const rows = [
    ['.pptx', 'Slides, titles, bullets, tables, speaker notes, comments, and the text in slide layouts and masters. Findings are reported by slide number.', GREEN],
    ['.docx', 'Body text, plus tracked changes, comments, highlighting, headers, footers and document properties.', GREEN],
    ['.md  .txt  .html', 'Fully supported.', GREEN],
    ['.pdf', 'Refused. Text pulled back out of a PDF garbles spacing and line breaks, so a check on it would report faults that are not in your document and miss ones that are. Check the file you made the PDF from.', BLOCKER],
    ['.doc  .ppt', 'Refused. Save as the modern format first.', MAJOR],
  ];
  let y = 1.92;
  for (const [fmt, text, colour] of rows) {
    s.addText(fmt, {
      x: M, y, w: 2.0, h: 0.4,
      fontFace: 'Courier New', fontSize: 14, bold: true, color: colour, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(text, {
      x: M + 2.2, y: y - 0.05, w: CW - 2.2, h: 0.86,
      fontFace: BODY, fontSize: 13.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.14,
    });
    y += 0.94;
    if (y < 6.3) s.addShape(pres.ShapeType.line, { x: M, y: y - 0.16, w: CW, h: 0, line: { color: RULE, width: 1 } });
  }
  s.addNotes('The PDF refusal surprises people. It is deliberate: a QA pass that invents faults is worse than no QA pass, and it trains people to ignore the tool.');
}

// ------------------------------------------------------- 13. the check list

{
  const s = pres.addSlide({ masterName: 'CONTENT' });
  title(s, `${ALL_RULES.length} checks, ${familyList.length} families`, 'Named under every finding, so you always know which kind of check raised it.');

  const cols = 3;
  const cardW = (CW - (cols - 1) * 0.3) / cols;
  const rowsPerCol = Math.ceil(familyList.length / cols);
  familyList.forEach(([name, n], i) => {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    const x = M + col * (cardW + 0.3);
    const y = 1.92 + row * 0.66;
    s.addText(name, {
      x, y, w: cardW - 0.75, h: 0.4,
      fontFace: BODY, fontSize: 14, color: INK, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(String(n), {
      x: x + cardW - 0.72, y: y + 0.04, w: 0.5, h: 0.32,
      fontFace: BODY, fontSize: 12, bold: true, color: MUTED,
      align: 'center', valign: 'middle', isTextBox: true, margin: 0,
    });
    s.addShape(pres.ShapeType.line, {
      x, y: y + 0.52, w: cardW - 0.2, h: 0, line: { color: RULE, width: 1 },
    });
  });
  s.addNotes('The full list with every rule name is in the handbook, which is a single HTML file that sits next to the tool.');
}

// ---------------------------------------------------------- 14. what to take

{
  const s = pres.addSlide({ masterName: 'DARK' });
  s.addText('What to take away', { placeholder: 'title' });

  const takeaways = [
    ['Run it before you read', 'It clears the mechanical faults so your read goes on argument and accuracy.'],
    ['A clean result is not sign-off', 'It cannot judge a finding, a severity or a recommendation. That stays with you.'],
    ['Fill in the engagement settings', 'Three checks depend on them, including the one that catches another client’s name.'],
    ['Nothing leaves the machine', 'No upload, no server, no account. Enforced by the build, not by a promise.'],
    ['Set aside what does not apply', 'You have the last word, and every exclusion is counted and visible.'],
  ];
  let y = 1.78;
  takeaways.forEach(([head, text], i) => {
    s.addText(String(i + 1).padStart(2, '0'), {
      x: M, y, w: 0.62, h: 0.44,
      fontFace: HEAD, fontSize: 18, bold: true, color: '5C87D6', isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(head, {
      x: M + 0.72, y, w: 4.5, h: 0.44,
      fontFace: HEAD, fontSize: 18, bold: true, color: WHITE, isTextBox: true, margin: 0, valign: 'middle',
    });
    s.addText(text, {
      x: M + 5.4, y, w: CW - 5.4, h: 0.44,
      fontFace: BODY, fontSize: 13.5, color: '9FB4CC', isTextBox: true, margin: 0, valign: 'middle',
    });
    y += 0.86;
  });

  s.addText([
    { text: 'The handbook  ', options: { bold: true, color: WHITE } },
    { text: 'report-qa-handbook.html sits beside the tool and has every check in it. Questions to Rajan Narwal.', options: { color: '9FB4CC' } },
  ], {
    x: M, y: 6.3, w: CW, h: 0.4,
    fontFace: BODY, fontSize: 13.5, isTextBox: true, margin: 0, valign: 'middle',
  });
  s.addNotes('Close on the first two. Everything else is mechanics that people will pick up by using it.');
}

await pres.writeFile({ fileName: OUT });
console.log(`Built ${OUT}`);
console.log(`  ${pres.slides?.length ?? '?'} slides, ${ALL_RULES.length} checks, ${familyList.length} families`);
