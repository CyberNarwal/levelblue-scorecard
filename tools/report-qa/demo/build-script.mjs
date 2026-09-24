/**
 * Build the presenter's run sheet for the live demo.
 *
 * The figures are taken by actually checking the demo draft, twice - once with
 * the engagement settings blank and once with them filled in - so the sheet
 * states what the tool will really say. A run sheet that disagrees with the
 * screen is worse than none, because it goes wrong in front of an audience.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CONFIG, resolveConfig } from '../src/config.mjs';
import { documentFromParagraphs } from '../src/document.mjs';
import { ALL_RULES, analyse } from '../src/engine.mjs';
import { extractPptx } from '../src/extract/pptx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const DRAFT = join(root, 'Northwind Trading - Security Assessment (DEMO DRAFT).pptx');
const OUT = join(root, 'report-qa-demo-script.html');

const ENGAGEMENT = {
  client: { name: 'Northwind Trading', aliases: [] },
  forbiddenClientNames: ['Contoso', 'Initech'],
  classification: 'CONFIDENTIAL',
};

function escape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function check(doc, extra) {
  return analyse(doc, {
    config: resolveConfig(DEFAULT_CONFIG, { dialect: 'en-GB', ...extra }),
    now: new Date(),
  });
}

const bytes = new Uint8Array(readFileSync(DRAFT));
const { paragraphs, meta } = extractPptx(bytes);
const doc = documentFromParagraphs(paragraphs, { source: 'demo', format: 'pptx', meta });

const blank = check(doc, {});
const filled = check(doc, ENGAGEMENT);
const unlocked = filled.findings.filter(
  (f) => !blank.findings.some((g) => g.rule === f.rule && g.message === f.message),
);
const leak = unlocked.find((f) => f.rule === 'slides/template-leakage');
if (!leak) throw new Error('the demo depends on the slide-master leak; it did not fire');

const n = (value) => `<span class="num">${value}</span>`;
const lit = (value) => `<span class="lit">${escape(value)}</span>`;

const PREFLIGHT = [
  ['<code>report-qa.html</code> open in Edge or Chrome, on a clean page',
   'No file loaded yet, and Engagement settings left blank. You fill them in during the demo.'],
  ['The demo draft on your desktop',
   '<code>Northwind Trading - Security Assessment (DEMO DRAFT).pptx</code>. Fictional client, planted faults.'],
  ['PowerPoint open, with nothing in it', 'You open the annotated copy in it at the end.'],
  ['This sheet on your second screen', 'Or half of one, with the tool on the other half.'],
  ['Say at the top that the client is invented',
   'It is called DEMO DRAFT in three places, but say it out loud anyway.'],
];

/**
 * DO is the action, SAY is the line, SEE is what the screen will show, WATCH is
 * what to do when it does not.
 */
const BEATS = [
  {
    title: 'Frame it before you touch anything',
    mins: 1,
    lines: [
      ['say', 'This is a QA pass we run <em>before</em> a draft goes near a client. It is one file. '
        + 'Nothing installs, nothing uploads, and nothing about the draft leaves the machine. '
        + 'It is the first of two stages — I will come back to the second at the end, because it '
        + 'is the important half.'],
      ['do', 'Point at the browser address bar so they can see it is a <code>file://</code> path, not a website.'],
      ['say', 'That is a local file. There is no server behind this.'],
    ],
  },
  {
    title: 'Drop the draft in, settings still blank',
    mins: 1,
    lines: [
      ['do', 'Drag the demo draft onto the drop zone. Do not fill in anything first.'],
      ['see', `Verdict reads <b>Do not send this yet</b>, with ${n(blank.stats.bySeverity.blocker)} blockers `
        + `and ${n(blank.stats.total)} findings in total.`],
      ['say', 'Four slides, and it has already found '
        + `${blank.stats.bySeverity.blocker} things that must not reach a client. Let me show you two of them.`],
      ['watch', 'If nothing happens, the file is probably still downloading. Check the status line under the drop zone.'],
    ],
  },
  {
    title: 'The one nobody sees: speaker notes',
    mins: 2,
    lines: [
      ['do', 'In the Blocker section, open <b>Internal remarks in the speaker notes</b>.'],
      ['see', `Rows on Slide 1 notes and Slide 2 notes, flagging ${lit("Don't mention")}, `
        + `${lit('day rate')} and ${lit('push them for more')}.`],
      ['say', 'These are in the speaker notes. Nobody put them on a slide, so nobody sees them by '
        + 'flicking through the deck — but they ship inside the file. If you send this, the client '
        + 'opens it and can read every one of them.'],
      ['do', 'Pause here. This is the moment people get it.'],
    ],
  },
  {
    title: 'The one that reads as wrong: a score against its own label',
    mins: 1,
    lines: [
      ['do', 'Open <b>CVSS score problem</b> in the Blocker section.'],
      ['see', 'Slide 2 — <span class="lit">CVSS 9.1 is "Critical" (9-10), but the text nearby says "Medium"</span>.'],
      ['say', 'The deck says the score is 9.1 and calls it Medium. One of those is wrong, and a client '
        + 'who checks will find it before we do.'],
    ],
  },
  {
    title: 'Now fill in the engagement — this is the one to watch',
    mins: 2,
    lines: [
      ['do', 'Open <b>Engagement settings</b>. Fill in: client <code>Northwind Trading</code>, '
        + 'other clients <code>Contoso, Initech</code>, marking <code>CONFIDENTIAL</code>.'],
      ['say', 'These describe the engagement, not the file. Watch what they unlock.'],
      ['do', 'Drop the same draft on again.'],
      ['see', `Now ${n(filled.stats.total)} findings and ${n(filled.stats.bySeverity.blocker)} blockers — `
        + `${n(unlocked.length)} more than before. The new blocker is: `
        + `<span class="lit">${escape(leak.message)}</span>`],
      ['say', 'That name is in the slide master — the template behind the slides. You will not find it '
        + 'by reading the deck, scrolling the deck, or printing the deck. It is the previous client, '
        + 'left in the file we copied. This is the one I would not have caught by eye, and it is the '
        + 'reason those four boxes are worth thirty seconds.'],
      ['watch', 'If the count does not change, the settings did not save. Re-open the panel and check the '
        + 'button now reads "for Northwind Trading".'],
    ],
  },
  {
    title: 'What a finding actually gives you',
    mins: 1,
    lines: [
      ['do', 'Scroll to any Major with a highlighted word, such as the American spellings on Slide 2.'],
      ['say', 'Every finding quotes your own words with the problem highlighted, and gives the '
        + 'replacement on the right. It is not a line number to go hunting with.'],
      ['do', 'Point out a whitespace finding if one is visible.'],
      ['say', 'It highlights spaces too. A highlighted blank is the only way you can see a double space at all.'],
    ],
  },
  {
    title: 'You get the last word',
    mins: 1,
    lines: [
      ['do', 'Hover any check and click <b>Ignore check</b>. Then scroll to the bottom.'],
      ['see', 'An <b>Ignored</b> section appears with a Restore button, and the count under the verdict '
        + 'now says how many you set aside.'],
      ['say', 'No rule set is right about everything. When it is wrong, you set it aside — but it is '
        + 'never silently gone. It is counted, it is listed, and every format you copy says how many '
        + 'were left out. A QA pass whose exclusions are invisible is one nobody can check.'],
      ['do', 'Click <b>Restore all</b> before moving on.'],
    ],
  },
  {
    title: 'Getting it back to the author',
    mins: 1,
    lines: [
      ['do', 'Click <b>For comments</b> on the Copy row, then paste into anything — Notepad is fine.'],
      ['say', 'One block per finding, with the exact words quoted and the fix. That is what goes in a '
        + 'comment beside the slide it belongs to.'],
      ['do', 'Point at Summary and Blocker list without clicking them.'],
      ['say', 'Summary is for the mail back to the consultant. Blocker list is the go/no-go note.'],
    ],
  },
  {
    title: 'The closer: comments written into the deck',
    mins: 2,
    lines: [
      ['do', 'Click <b>Download deck with comments</b>. Open the downloaded file in PowerPoint and '
        + 'show the comment pane on slide 1.'],
      ['see', `A copy named <code>… (QA comments).pptx</code> carrying ${n(filled.findings.length)} real `
        + 'PowerPoint comments, on the slides they came from.'],
      ['say', 'That is the part that used to cost an hour — reading a QA report and retyping each point '
        + 'into the deck. The consultant opens this, works the comment pane, resolves each one. '
        + 'And it is a copy. The file you dropped in is never touched.'],
      ['watch', 'If PowerPoint offers to repair the file, do not fight it on stage — close it, say the '
        + 'annotated copy is the newest part of the tool, and carry on. Tell Rajan afterwards.'],
    ],
  },
  {
    title: 'What it cannot do — do not skip this',
    mins: 1,
    lines: [
      ['say', 'Everything you have seen is mechanical. It cannot tell you whether a finding is right, '
        + 'whether a severity is justified, or whether the remediation advice would actually work. '
        + 'It cannot read a screenshot. It has no idea who the client is or what we promised them.'],
      ['say', 'So a clean result is not sign-off. It clears the noise so that the read you do next is '
        + 'spent on the argument instead of on typos. That read is still yours.'],
      ['do', 'Say this one slowly. It is the thing you most want them to leave with.'],
    ],
  },
  {
    title: 'Where to get it',
    mins: 0.5,
    lines: [
      ['do', 'Show the footer of the tool with its version stamp.'],
      ['say', 'It is on SharePoint beside the handbook. Save the file, open it whenever you like. '
        + 'When I update the checks I replace that one file and you pick it up next time you open it. '
        + 'The version is printed at the bottom so you can see which copy you have.'],
      ['say', 'The handbook next to it explains every check and the four levels. Anything odd, send it to me.'],
    ],
  },
];

const QA = [
  ['Does anything actually leave the machine?',
   'No. There is no upload, no server, no account and no telemetry. You can unplug the network and it '
   + 'works exactly the same — that is a fair thing to ask me to demonstrate. The build refuses to '
   + 'produce a file that contains a network call at all, so it is enforced rather than promised.'],
  ['What if it flags something that is fine?',
   'Set it aside with Ignore, and it comes out of the list and out of everything you copy. It is still '
   + 'counted at the top so the exclusion is visible. <strong>Do not change good writing to satisfy a '
   + 'rule.</strong> If a check is wrong often, tell me and I will fix the check.'],
  ['Does it work on Word documents?',
   'Yes — body text, tracked changes, comments, highlighting, headers, footers and document properties. '
   + 'The only thing Word does not get yet is comments written back into the file, because Word anchors '
   + 'them to exact runs of text rather than to a page. That is a harder problem and it is on the list.'],
  ['Can it fix things automatically?',
   'The command line version can apply the unambiguous corrections. The page deliberately does not — it '
   + 'reports and leaves the change to you, because a tool that edits a client deliverable on your behalf '
   + 'is a different risk conversation.'],
  ['Why will it not take a PDF?',
   'Because text pulled back out of a PDF garbles spacing and line breaks. It would report faults that '
   + 'are not in your document and miss ones that are. A QA pass that invents faults is worse than none, '
   + 'so it refuses rather than guessing. Check the file you made the PDF from.'],
  ['How do I know my copy is current?',
   'The version and check count are printed at the foot of the tool. If it does not match the one on '
   + 'SharePoint, download it again — replacing the file is the whole update mechanism.'],
  ['Who maintains it, and what happens when a framework version moves?',
   'I do. Things like the current PCI DSS or CIS version are written into the checks and need updating '
   + 'when they move, which is a small change and a rebuild. Tell me when you spot one out of date.'],
];

function preflight() {
  return PREFLIGHT.map(([label, note]) => `
      <label><input type="checkbox"><span>${label}<span class="note">${note}</span></span></label>`).join('');
}

function beats() {
  return BEATS.map((beat, i) => {
    const lines = beat.lines.map(([kind, body]) => {
      const tag = { do: 'Do', say: 'Say', see: 'See', watch: 'If not' }[kind];
      return `
        <div class="line ${kind}"><span class="tag">${tag}</span><div class="body">${body}</div></div>`;
    }).join('');
    return `
    <article class="beat">
      <div class="beat-head">
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <h3>${beat.title}</h3>
        <span class="mins">${beat.mins < 1 ? '30 sec' : `${beat.mins} min`}</span>
      </div>${lines}
    </article>`;
  }).join('');
}

function questions() {
  return QA.map(([q, a]) => `
    <details class="qa"><summary>${q}</summary><div class="a">${a}</div></details>`).join('');
}

const date = new Date().toISOString().slice(0, 10);
let commit = 'local';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  // a copy built outside a checkout still gets a dated sheet
}

const total = BEATS.reduce((sum, b) => sum + b.mins, 0);
const html = readFileSync(join(here, 'template.html'), 'utf8')
  .replace('__PREFLIGHT__', preflight())
  .replace('__BEATS_HTML__', beats())
  .replace('__QA__', questions())
  .replace(/__BEATS__/g, String(BEATS.length))
  .replace(/__TOTAL__/g, String(Math.round(total)))
  .replace(/__CHECKS__/g, String(ALL_RULES.length))
  .replace(/__VERSION__/g, date)
  .replace(/__COMMIT__/g, commit)
  .replace(/__DATE__/g, date);

if (/<link\b[^>]*\bhref=["']https?:|<script\b[^>]*\bsrc=["']https?:|\bfetch\s*\(/.test(html)) {
  throw new Error('the run sheet must be self-contained, like the tool it describes');
}

writeFileSync(OUT, html);
console.log(`Built ${OUT}`);
console.log(`  ${BEATS.length} beats, about ${Math.round(total)} minutes`);
console.log(`  settings blank: ${blank.stats.total} findings, ${blank.stats.bySeverity.blocker} blockers`);
console.log(`  settings filled: ${filled.stats.total} findings, ${filled.stats.bySeverity.blocker} blockers`);
console.log(`  the settings unlock ${unlocked.length}, including the slide-master leak`);
