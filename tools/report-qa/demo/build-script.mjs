/**
 * Build the presenter's script for the live demo, as a Word document.
 *
 * The figures are taken by actually checking the demo draft, twice - once with
 * the engagement settings blank and once with them filled in - so the script
 * states what the tool will really say. A script that disagrees with the screen
 * is worse than none, because it goes wrong in front of an audience.
 *
 *     node tools/report-qa/demo/build-script.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun,
} from 'docx';

import { DEFAULT_CONFIG, resolveConfig } from '../src/config.mjs';
import { documentFromParagraphs } from '../src/document.mjs';
import { ALL_RULES, analyse } from '../src/engine.mjs';
import { extractPptx } from '../src/extract/pptx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const DRAFT = join(root, 'Northwind Trading - Security Assessment (DEMO DRAFT).pptx');
const OUT = join(root, 'Report QA - demo script.docx');

const ENGAGEMENT = {
  client: { name: 'Northwind Trading', aliases: [] },
  forbiddenClientNames: ['Contoso', 'Initech'],
  classification: 'CONFIDENTIAL',
};

function check(document, extra) {
  return analyse(document, {
    config: resolveConfig(DEFAULT_CONFIG, { dialect: 'en-GB', ...extra }),
    now: new Date(),
  });
}

const bytes = new Uint8Array(readFileSync(DRAFT));
const { paragraphs, meta } = extractPptx(bytes);
const draft = documentFromParagraphs(paragraphs, { source: 'demo', format: 'pptx', meta });

const blank = check(draft, {});
const filled = check(draft, ENGAGEMENT);
const unlocked = filled.findings.filter(
  (f) => !blank.findings.some((g) => g.rule === f.rule && g.message === f.message),
);
if (!unlocked.some((f) => f.rule === 'slides/template-leakage')) {
  throw new Error('the demo depends on the slide-master leak; it did not fire');
}

const securityChecks = ALL_RULES.filter((r) => r.category === 'Security accuracy').length;
const families = new Set(ALL_RULES.map((r) => r.category)).size;

/* -------------------------------------------------------------------------
 * The script.
 *
 * `do` is something you do and prints in bold. `say` is something you say,
 * written the way you would say it rather than the way it would be written
 * down. The rest are notes to yourself and print in italics, so your eye skips
 * them while you are talking.
 * ---------------------------------------------------------------------- */

const BEFORE = [
  'Open report-qa.html in Edge or Chrome. Nothing loaded, and leave the engagement settings blank to '
  + 'start with – you fill those in during the demo.',
  'Put the demo draft on your desktop: "Northwind Trading - Security Assessment (DEMO DRAFT).pptx".',
  'Have PowerPoint open with nothing in it. You open the annotated copy in it at the end.',
  'Keep this script on a second screen, or print it.',
  'Say out loud at the start that Northwind Trading is invented. The file says DEMO DRAFT in three '
  + 'places, but say it anyway.',
];

const BEATS = [
  {
    title: 'Start with the problem, not the tool',
    mins: '1 min',
    lines: [
      ['say', 'Every draft we send gets read before it goes out, and that read is doing two jobs at '
        + 'once. Is the argument right, and is the document clean. The second job is the one that goes '
        + 'badly at five o\'clock on a Friday, and it\'s the one a machine can do perfectly every '
        + 'single time.'],
      ['say', 'So we run this first, and then you read it. One file. Nothing to install, nothing to log '
        + 'into, and nothing about the draft goes anywhere.'],
      ['do', 'Point at the address bar.'],
      ['say', 'That\'s a file path, not a web address. There\'s no server behind this. If anyone ever '
        + 'asks you whether client material is being sent somewhere, that\'s your answer. And it isn\'t '
        + 'just a promise – the thing that builds this file refuses to produce it at all if it contains '
        + 'a single network call.'],
    ],
  },
  {
    title: 'Drop the draft in and let it talk',
    mins: '1 min',
    lines: [
      ['do', 'Drag the demo draft onto the page. Don\'t fill anything in first.'],
      ['say', 'Four slides. In about a second it has read every slide, every speaker note, the tables, '
        + 'the slide layouts, the master behind them, and the file\'s own properties. And it says '
        + `don't send it – ${blank.stats.bySeverity.blocker} things here must not reach a client.`],
      ['say', 'Worth noticing where it just looked. Nobody proofreads a slide master. That\'s exactly '
        + 'where the worst thing in this deck is hiding, and I\'ll come back to it.'],
      ['note', `You should see "Do not send this yet", ${blank.stats.bySeverity.blocker} blockers and `
        + `${blank.stats.total} findings in total.`],
      ['trouble', 'Nothing happened? The file is probably still downloading. Check the line under the '
        + 'drop zone.'],
    ],
  },
  {
    title: 'The one nobody ever sees',
    mins: '2 min',
    lines: [
      ['do', 'Open "Internal remarks in the speaker notes".'],
      ['say', 'These are in the speaker notes. Nobody put them on a slide, so nobody finds them by '
        + 'flicking through the deck. But they travel inside the file. You send this, the client opens '
        + 'it, and they can read every one of them.'],
      ['say', 'And look at what it\'s matching. Not swearing. Commercial phrasing. Day rate. Push them '
        + 'for more. Guesstimate. The things we write to each other, which read very differently to the '
        + 'person paying the invoice.'],
      ['say', 'Exporting to PDF would strip these out. We almost never send PDFs.'],
      ['pause', 'Stop talking here. Let them read it.'],
    ],
  },
  {
    title: 'A number arguing with itself',
    mins: '1 min',
    lines: [
      ['do', 'Open "CVSS score problem".'],
      ['say', 'The deck says the score is 9.1 and calls it Medium. One of those is wrong. It\'s reading '
        + 'the score, looking up which band 9.1 actually falls in, and comparing that to the severity '
        + 'word sitting next to it.'],
      ['say', 'This is the kind of thing that does real damage, because it isn\'t a typo. A client who '
        + 'checks one number and finds it wrong now has a reason to check all of them. There are '
        + `${securityChecks} checks like this one – CVE formats, ATT&CK technique IDs, NIST CSF `
        + 'identifiers, and whether the framework version you\'re citing is still the current one.'],
    ],
  },
  {
    title: 'Four boxes, and the findings nobody could have caught',
    mins: '3 min',
    lines: [
      ['do', 'Open "Engagement settings". Type Northwind Trading, then Contoso, Initech, then '
        + 'CONFIDENTIAL.'],
      ['say', 'These four describe the engagement rather than the file. They\'re remembered on your '
        + 'machine and they apply to everything you check until you change them.'],
      ['do', 'Drop the same file on again.'],
      ['say', `Same deck. It's now ${filled.stats.total} findings and `
        + `${filled.stats.bySeverity.blocker} blockers, and these are the ones I want you to see.`],
      ['say', 'Contoso appears in the deck\'s slide masters. That name is in the template behind the '
        + 'slides. You won\'t find it by reading the deck, scrolling the deck or printing the deck. '
        + 'It\'s the previous client, sitting in the file somebody copied to make this one.'],
      ['say', 'Which is how it always happens. You open last quarter\'s deck, save as, replace the '
        + 'slides. The master keeps whatever was in it.'],
      ['say', 'It found Contoso in the file\'s own properties too – the author field still reads '
        + 'Contoso Financial Services. That one follows the file everywhere, and right-clicking it in '
        + 'Explorer is enough to see it.'],
      ['say', 'Neither of those would I have caught by eye. They\'re also the most damaging things on '
        + 'the list, because they aren\'t mistakes in the writing. They\'re evidence to one client that '
        + 'we recycle another client\'s material.'],
      ['say', 'That\'s what those four boxes buy you. Thirty seconds.'],
      ['note', 'The settings also unlocked the missing CONFIDENTIAL marking. Same principle – it can\'t '
        + 'check a name or a marking you haven\'t told it to expect.'],
      ['trouble', 'Count didn\'t change? The settings didn\'t save. Re-open the panel and check the '
        + 'button now reads "for Northwind Trading".'],
    ],
  },
  {
    title: 'What a finding actually hands you',
    mins: '1 min',
    lines: [
      ['do', 'Scroll to one of the spelling findings on slide 2.'],
      ['say', 'It quotes your own sentence back with the problem highlighted, and puts the replacement '
        + 'underneath. Not a line number and a rule name to go hunting with – the actual words, so you '
        + 'can match it against what\'s on your screen.'],
      ['say', 'It highlights spaces too. A highlighted blank is the only way you can see a double space '
        + 'at all.'],
      ['say', 'And it groups them. One check firing eight times is one card with a count and a preview '
        + 'of the words, not eight rows saying the same thing.'],
    ],
  },
  {
    title: 'You get the last word',
    mins: '1 min',
    lines: [
      ['do', 'Hover a card and click "Ignore check", then scroll to the bottom.'],
      ['say', 'No rule set is right about everything. When it\'s wrong, you set it aside. The important '
        + 'part is that it never just disappears – it\'s counted, it\'s listed down here with a Restore '
        + 'next to it, and every format you copy out says how many were left out.'],
      ['say', 'Because a QA pass whose exclusions are invisible is one nobody can check. Including you, '
        + 'six months later, when someone asks why a finding wasn\'t actioned.'],
      ['say', 'And please don\'t change good writing to satisfy a rule. If a check is wrong often, tell '
        + 'me and I\'ll fix the check.'],
      ['do', 'Click "Restore all" before you move on.'],
    ],
  },
  {
    title: 'Getting it back to whoever wrote it',
    mins: '1 min',
    lines: [
      ['do', 'Click "For comments", then paste into anything. Notepad is fine.'],
      ['say', 'One block per finding. Where it is, what\'s wrong, the exact words, and the fix. That\'s '
        + 'what goes into a comment next to the slide it belongs to.'],
      ['do', 'Point at "Summary" and "Blocker list" without clicking.'],
      ['say', 'Summary is one line per finding with the blockers first – that\'s your mail back to the '
        + 'consultant. Blocker list is only what stops it going out, which is the go or no-go note. All '
        + 'of them quote the words, because "line 42 has an American spelling" sends somebody hunting '
        + 'and "found: color" doesn\'t.'],
    ],
  },
  {
    title: 'The bit that used to take an hour',
    mins: '2 min',
    lines: [
      ['do', 'Click "Download deck with comments", then open the downloaded file in PowerPoint.'],
      ['say', `A copy of the deck carrying ${filled.findings.length} real PowerPoint comments, each one `
        + 'on the slide it came from. The consultant opens this, works down the comment pane, and '
        + 'resolves them as they go.'],
      ['say', 'This is the part that used to cost the most time – reading a QA report on one screen and '
        + 'retyping every point into the deck on the other.'],
      ['say', 'And it\'s a copy. The file you dropped in is read and never written to. Comments already '
        + 'in the deck are kept, with whoever wrote them. Run it twice and the second pass adds to the '
        + 'first rather than replacing it.'],
      ['note', 'Word doesn\'t do this yet. Word anchors comments to exact runs of text rather than to a '
        + 'page, which is a harder problem. For Word, use the copy formats.'],
      ['trouble', 'PowerPoint offers to repair the file? Don\'t fight it in front of people. Close it, '
        + 'say the annotated copy is the newest part of the tool, carry on with the copy formats, and '
        + 'tell me afterwards.'],
    ],
  },
  {
    title: 'What it cannot do, and why that matters',
    mins: '2 min',
    lines: [
      ['say', 'Everything you\'ve just seen is mechanical. It can\'t tell you whether a finding is '
        + 'right. It can\'t tell you whether a severity is justified, or whether the remediation advice '
        + 'would actually work. It can\'t read a screenshot or a diagram. It has no idea who the client '
        + 'is, what we promised them, or what the politics of the engagement are.'],
      ['say', 'So a clean result is not sign-off. What it does is clear the noise, so the read you do '
        + 'next is spent on the argument instead of on typos. That read is still yours, and it\'s the '
        + 'half that actually protects the client.'],
      ['pause', 'Say this one slowly, and say it even if you are running short. It is the thing you '
        + 'most want them to leave with.'],
    ],
  },
  {
    title: 'Where to get it',
    mins: '30 sec',
    lines: [
      ['do', 'Show the version stamp at the foot of the tool.'],
      ['say', 'It\'s on SharePoint next to the handbook. Save the file and open it whenever you like. '
        + 'When I update the checks I replace that one file and you pick it up next time you open it – '
        + 'the version is printed at the bottom so you can tell which copy you\'ve got.'],
      ['say', 'The handbook explains every check and what the four levels mean. Anything that looks '
        + 'wrong to you, send it to me.'],
    ],
  },
];

const QUESTIONS = [
  ['Does anything actually leave the machine?',
    'No. There\'s no upload, no server, no account and no telemetry. You can unplug the network and it '
    + 'works exactly the same – that\'s a fair thing to ask me to demonstrate. The build refuses to '
    + 'produce a file that contains a network call at all, so it\'s enforced rather than promised.'],
  ['What if it flags something that\'s fine?',
    'Set it aside with Ignore and it comes out of the list and out of everything you copy. It\'s still '
    + 'counted at the top, so the exclusion stays visible. Don\'t change good writing to satisfy a '
    + 'rule. If a check is wrong often, tell me and I\'ll fix the check.'],
  ['Does it work on Word documents?',
    'Yes – body text, tracked changes, comments, highlighting, headers, footers and document '
    + 'properties. The only thing Word doesn\'t get yet is comments written back into the file, '
    + 'because Word anchors them to exact runs of text rather than to a page. That\'s a harder problem '
    + 'and it\'s on the list.'],
  ['Can it fix things automatically?',
    'The command line version can apply the unambiguous corrections. The page deliberately doesn\'t – '
    + 'it reports and leaves the change to you, because a tool that edits a client deliverable on your '
    + 'behalf is a different risk conversation.'],
  ['Why won\'t it take a PDF?',
    'Because text pulled back out of a PDF garbles spacing and line breaks. It would report faults that '
    + 'aren\'t in your document and miss ones that are. A QA pass that invents faults is worse than '
    + 'none, so it refuses rather than guessing. Check the file you made the PDF from.'],
  ['How do I know my copy is current?',
    'The version and the check count are printed at the foot of the tool. If it doesn\'t match the one '
    + 'on SharePoint, download it again – replacing the file is the whole update mechanism.'],
  ['Who maintains it, and what happens when a framework version moves?',
    'I do. Things like the current PCI DSS or CIS version are written into the checks and need '
    + 'updating when they move, which is a small change and a rebuild. Tell me when you spot one out '
    + 'of date.'],
];

/* ---------------------------------------------------------------- rendering */

const INK = '1A1A1A';
const GREY = '595959';
const BLUE = '0B4DA2';
const RULE = { style: 'single', size: 6, color: 'D9D9D9', space: 10 };

const say = (text) => new Paragraph({
  children: [new TextRun({ text, color: INK })],
  spacing: { after: 160, line: 288 },
});

const action = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, color: BLUE })],
  spacing: { before: 60, after: 160, line: 288 },
});

const aside = (label, text) => new Paragraph({
  children: [
    new TextRun({ text: `${label} `, italics: true, bold: true, color: GREY }),
    new TextRun({ text, italics: true, color: GREY }),
  ],
  spacing: { after: 160, line: 276 },
  indent: { left: 280 },
});

const RENDER = {
  say,
  do: action,
  note: (text) => aside('Note.', text),
  trouble: (text) => aside('If it goes wrong.', text),
  pause: (text) => aside('Pause.', text),
};

const heading = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, bold: true, size: 28, color: BLUE })],
  spacing: { before: 400, after: 180 },
  keepNext: true,
});

let commit = 'local';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  // a copy built outside a checkout still gets a dated script
}
const date = new Date().toISOString().slice(0, 10);

const children = [
  new Paragraph({
    children: [new TextRun({ text: 'Report QA', bold: true, size: 44, color: INK })],
    spacing: { after: 40 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'A script for the live demo', size: 26, color: GREY })],
    spacing: { after: 240 },
  }),
  new Paragraph({
    children: [new TextRun({
      text: 'About 15 minutes. Rajan Narwal, Manager, Cyber Advisory.',
      color: INK,
    })],
    spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({
      text: `Every number below was checked against build ${commit} on ${date}. If the screen says `
        + 'something different the tool has moved on \u2013 say so and carry on, it does not affect '
        + 'the point.',
      italics: true,
      color: GREY,
      size: 20,
    })],
    spacing: { after: 240 },
    border: { bottom: RULE },
  }),
];

children.push(heading('Before you start'));
for (const line of BEFORE) {
  children.push(new Paragraph({
    text: line,
    numbering: { reference: 'ticks', level: 0 },
    spacing: { after: 110, line: 288 },
  }));
}

children.push(heading('The demo'));
BEATS.forEach((beat, index) => {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({ text: `${index + 1}. ${beat.title}`, bold: true, size: 26, color: INK }),
      new TextRun({ text: `\u2003${beat.mins}`, color: GREY, size: 19 }),
    ],
    spacing: { before: 340, after: 150 },
    keepNext: true,
  }));
  for (const [kind, text] of beat.lines) children.push(RENDER[kind](text));
});

children.push(heading('If someone asks'));
for (const [question, answer] of QUESTIONS) {
  children.push(new Paragraph({
    children: [new TextRun({ text: question, bold: true, color: INK })],
    spacing: { before: 220, after: 70, line: 288 },
    keepNext: true,
  }));
  children.push(say(answer));
}

children.push(new Paragraph({
  children: [new TextRun({
    text: `Report QA ${date} · ${ALL_RULES.length} checks in ${families} families`,
    color: GREY,
    size: 19,
  })],
  spacing: { before: 420 },
  border: { top: RULE },
}));

const document = new Document({
  creator: 'Rajan Narwal',
  title: 'Report QA - demo script',
  description: 'Presenter script for the Report QA live demo',
  styles: { default: { document: { run: { font: 'Calibri', size: 22, color: INK } } } },
  numbering: {
    config: [{
      reference: 'ticks',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 260 } } },
      }],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 1134, right: 1247, bottom: 1134, left: 1247 } } },
    children,
  }],
});

writeFileSync(OUT, await Packer.toBuffer(document));
console.log(`Built ${OUT}`);
console.log(`  ${BEATS.length} steps, ${QUESTIONS.length} questions, about 15 minutes`);
console.log(`  settings blank: ${blank.stats.total} findings, ${blank.stats.bySeverity.blocker} blockers`);
console.log(`  settings filled: ${filled.stats.total} findings, ${filled.stats.bySeverity.blocker} blockers`);
console.log(`  the settings unlock ${unlocked.length}, including the slide-master leak`);
