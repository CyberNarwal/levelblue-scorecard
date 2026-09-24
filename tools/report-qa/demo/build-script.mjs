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
const BRIEFING = [
  ['What it is',
   'A rule engine in a single HTML file. <b>__CHECKS__ checks</b> in <b>__FAMILIES__ families</b>, '
   + 'split <b>__BLOCKERS__ blocker, __MAJORS__ major, __MINORS__ minor, __NITS__ nit</b>. Rules, not AI - '
   + 'it gives the same answer twice and can tell you which rule fired.'],
  ['Why rules',
   'Because a QA tool has to be trusted more than it has to be clever. A rule either matched or it '
   + 'did not, so a finding can always be traced to a named check, and the same draft checked twice '
   + 'gives the same answer. That is what lets you argue with it.'],
  ['How it stays offline',
   'No upload, no server, no account, no telemetry. The build script <b>refuses to emit a file</b> '
   + 'containing a network call, an external script or a link to anything outside itself - so the '
   + 'guarantee is enforced rather than promised. Unplug the network and it behaves identically.'],
  ['What it reads',
   '<b>.pptx</b> including speaker notes, comments, tables, slide layouts and masters. '
   + '<b>.docx</b> including tracked changes, comments, highlighting, headers, footers and document '
   + 'properties. Also .md and .html. It refuses .pdf on purpose.'],
  ['Where it came from',
   'Manual QA was a read-through, then comments typed into the deck by hand. The mechanical half of '
   + 'that is what a rule can do perfectly and a tired reader cannot. The judgement half is what '
   + 'stays with us.'],
  ['The one sentence',
   'If they remember one thing: <b>it clears the mechanical faults so the read you do next is spent '
   + 'on the argument.</b> A clean result is not sign-off.'],
];

/**
 * DO is the action, SAY is the line, WHY is the reasoning behind it to draw on
 * or answer with, SEE is what the screen will show, WATCH is what to do when
 * it does not.
 */
const BEATS = [
  {
    title: 'Frame it before you touch anything',
    mins: 1,
    lines: [
      ['say', 'Before any draft goes to a client, someone reads it. That read is doing two jobs at '
        + 'once — checking the argument holds, and catching typos, spacing, a wrong client name. '
        + 'The second job is the one that goes badly at five o\'clock on a Friday, and it is the '
        + 'one a machine can do perfectly.'],
      ['say', 'So this runs first. It is one file, it installs nothing, and <em>nothing about the draft '
        + 'leaves your machine</em>. It is the first of two stages, and I will come back to the '
        + 'second at the end because it is the important half.'],
      ['do', 'Point at the address bar so they can see the <code>file://</code> path.'],
      ['why', 'That path is the proof. A local file has no server behind it. If anyone asks later '
        + 'whether client material is being sent anywhere, this is the answer you point at — '
        + 'and the build refuses to produce a file containing a network call at all.'],
    ],
  },
  {
    title: 'Drop the draft in, settings still blank',
    mins: 1,
    lines: [
      ['do', 'Drag the demo draft onto the drop zone. Do not fill in anything first.'],
      ['see', `Verdict reads <b>Do not send this yet</b>, with ${n(blank.stats.bySeverity.blocker)} blockers `
        + `and ${n(blank.stats.total)} findings in total.`],
      ['say', 'Four slides, and in under a second it has read every slide, every speaker note, the '
        + 'tables, the slide layouts, the master behind them, and the file\'s own document '
        + `properties. It has found ${blank.stats.bySeverity.blocker} things that must not reach a client.`],
      ['why', 'Worth naming what it just read, because the non-obvious places are where the damaging '
        + 'things hide. Nobody proofreads a slide master. The verdict line is deliberately blunt — '
        + '<b>Do not send this yet</b> — because the one thing a reviewer needs in the first second '
        + 'is whether this is a go or a no-go.'],
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
      ['say', 'These are in the speaker notes. Nobody put them on a slide, so nobody finds them by '
        + 'flicking through the deck — but they travel inside the file. Send this and the client '
        + 'opens it and can read every one.'],
      ['say', 'And notice what it is actually matching. Not swear words — commercial phrasing. '
        + '<em>Day rate. Push them for more. Guesstimate. Chargeable.</em> The things we write to '
        + 'each other that read very differently to the person paying the invoice.'],
      ['why', 'This is the beat that lands, so give it room. Two things worth adding if they engage: '
        + 'exporting to PDF drops the notes, but we rarely send PDFs; and the tool reports the notes '
        + 'separately as a Major even when the content is harmless, because <b>notes shipping at all</b> '
        + 'is usually not intended.'],
      ['do', 'Pause here. Let it sit before moving on.'],
    ],
  },
  {
    title: 'The one that reads as wrong: a score against its own label',
    mins: 1,
    lines: [
      ['do', 'Open <b>CVSS score problem</b> in the Blocker section.'],
      ['see', 'Slide 2 — <span class="lit">CVSS 9.1 is "Critical" (9-10), but the text nearby says "Medium"</span>.'],
      ['say', 'The deck says the score is 9.1 and calls it Medium. One of those is wrong. A client '
        + 'who checks will find it before we do, and then every other number in the report is in question.'],
      ['why', 'It is reading the score, looking up the CVSS v3.1 band that score falls in, and '
        + 'comparing it to the severity word nearby. The same family checks CVE identifiers, '
        + 'MITRE ATT&amp;CK technique IDs, NIST CSF subcategories, and whether a framework version '
        + 'you cite is still current. That is <b>__SECURITY__ checks</b> on security accuracy alone.'],
    ],
  },
  {
    title: 'Now fill in the engagement — this is the one to watch',
    mins: 2,
    lines: [
      ['do', 'Open <b>Engagement settings</b>. Fill in: client <code>Northwind Trading</code>, '
        + 'other clients <code>Contoso, Initech</code>, marking <code>CONFIDENTIAL</code>.'],
      ['say', 'These four describe the engagement rather than the file. They are remembered on your '
        + 'machine and apply to every draft until you change them. Watch what they unlock.'],
      ['do', 'Drop the same draft on again.'],
      ['see', `Now ${n(filled.stats.total)} findings and ${n(filled.stats.bySeverity.blocker)} blockers — `
        + `${n(unlocked.length)} more than before. The new blocker is: `
        + `<span class="lit">${escape(leak.message)}</span>`],
      ['say', 'That name is in the slide master — the template behind the slides. You will not find '
        + 'it by reading the deck, scrolling the deck, or printing the deck. It is the previous '
        + 'client, sitting in the file we copied to make this one.'],
      ['say', 'This is the one I would not have caught by eye. It is also the single most damaging '
        + 'thing on the list, because it is not a typo — it is evidence to one client that we reuse '
        + 'another client\'s material. Which is why those four boxes are worth thirty seconds.'],
      ['why', 'How it happens: someone opens last quarter\'s deck, saves as, replaces the slides. '
        + 'The master keeps whatever was in it. The tool reads the layouts and masters as well as '
        + 'the slides, which is why it sees what a reader cannot. The second thing the settings '
        + 'unlocked is the missing <b>CONFIDENTIAL</b> marking — same principle, it cannot check '
        + 'a marking you have not told it to expect.'],
      ['watch', 'If the count does not change, the settings did not save. Re-open the panel and check the '
        + 'button now reads "for Northwind Trading".'],
    ],
  },
  {
    title: 'What a finding actually gives you',
    mins: 1,
    lines: [
      ['do', 'Scroll to a Major with a highlighted word, such as the American spellings on Slide 2.'],
      ['say', 'Every finding quotes your own words back with the problem highlighted, and the '
        + 'replacement on the right. Not a line number and a rule name to go hunting with — the '
        + 'actual sentence, so you can match it to what is on your screen.'],
      ['say', 'It highlights whitespace too. A highlighted blank is the only way you can see a '
        + 'double space at all.'],
      ['why', 'This was the biggest change made to the tool. It used to report the rule and roughly '
        + 'where. People then had to go and find the thing, which is the slow part of acting on a '
        + 'QA report. Findings are also grouped by check, so one rule firing eight times is one row '
        + 'with a count and a preview, not eight rows repeating themselves.'],
    ],
  },
  {
    title: 'You get the last word',
    mins: 1,
    lines: [
      ['do', 'Hover any check and click <b>Ignore check</b>. Then scroll to the bottom.'],
      ['see', 'An <b>Ignored</b> section appears with a Restore on each, and the count under the '
        + 'verdict says how many you set aside.'],
      ['say', 'No rule set is right about everything. When it is wrong you set it aside — and the '
        + 'important part is that it is never silently gone. It is counted, it is listed, and every '
        + 'format you copy out says how many were left out.'],
      ['say', 'Please do not change good writing to satisfy a rule. If a check is wrong often, tell '
        + 'me and I will fix the check.'],
      ['why', 'A QA pass whose exclusions are invisible is one nobody can audit — including you, six '
        + 'months later, when someone asks why a finding was not actioned. Two design notes if asked: '
        + 'decisions survive re-checking the same draft after edits, because they are keyed to the '
        + 'flagged words rather than a line number; and they are <b>deliberately not saved to disk</b>, '
        + 'because the keys would write client text into browser storage.'],
      ['do', 'Click <b>Restore all</b> before moving on.'],
    ],
  },
  {
    title: 'Getting it back to the author',
    mins: 1,
    lines: [
      ['do', 'Click <b>For comments</b> on the Copy row, then paste into anything — Notepad is fine.'],
      ['say', 'One block per finding: where it is, what is wrong, the exact words, and the fix. That '
        + 'is what goes into a comment beside the slide it belongs to.'],
      ['do', 'Point at Summary and Blocker list without clicking them.'],
      ['say', 'Summary is one line per finding with blockers first — that is the mail back to the '
        + 'consultant. Blocker list is only what stops the draft going out, which is the go/no-go '
        + 'note. Full report is the lot, in Markdown, for a review thread.'],
      ['why', 'All four quote the flagged text, for the same reason as the last beat: '
        + '<b>"line 42 has an American spelling"</b> sends the author hunting, and '
        + '<b>Found: "color"</b> does not. Anything you set aside is excluded from all four, and '
        + 'each one states the number it left out.'],
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
      ['say', 'This is the part that used to cost the most time — reading a QA report and retyping '
        + 'every point into the deck as a comment. The consultant opens this, works the comment '
        + 'pane, resolves each one as they go.'],
      ['say', 'And it is a copy. The file you dropped in is read and never written to. Comments '
        + 'already in the deck are kept, with whoever wrote them. Run it twice and the second pass '
        + 'adds rather than replaces.'],
      ['why', 'It works for PowerPoint because a PowerPoint comment is anchored to a slide, and the '
        + 'tool already knows which slide a finding came from. Word anchors comments to exact runs '
        + 'of text inside the document, which is a harder problem and is not done yet — so for Word '
        + 'you use the Copy formats. The slides themselves are copied across byte for byte, so '
        + 'nothing is re-encoded behind the author\'s back.'],
      ['watch', 'If PowerPoint offers to repair the file, do not fight it on stage — close it, say the '
        + 'annotated copy is the newest part of the tool, and carry on with the Copy formats. '
        + 'Tell Rajan afterwards.'],
    ],
  },
  {
    title: 'What it cannot do — do not skip this',
    mins: 1,
    lines: [
      ['say', 'Everything you have seen is mechanical. It cannot tell you whether a finding is right, '
        + 'whether a severity is justified, or whether the remediation advice would actually work. '
        + 'It cannot read a screenshot or a diagram. It has no idea who the client is, what we '
        + 'promised them, or what the politics of the engagement are.'],
      ['say', 'So a clean result is <em>not</em> sign-off. What it does is clear the noise, so the read '
        + 'you do next is spent on the argument instead of on typos. That read is still yours, and '
        + 'it is the half that actually protects the client.'],
      ['why', 'Say this slowly, and say it even if you are short on time. The failure mode for a tool '
        + 'like this is people trusting it to have checked things it never looked at. It is also the '
        + 'honest answer to anyone who thinks it is here to replace the review.'],
    ],
  },
  {
    title: 'Where to get it',
    mins: 0.5,
    lines: [
      ['do', 'Show the footer of the tool with its version stamp.'],
      ['say', 'It is on SharePoint beside the handbook. Save the file and open it whenever you like. '
        + 'When I update the checks I replace that one file, and you pick it up next time you open '
        + 'it — the version is printed at the bottom so you can see which copy you have.'],
      ['say', 'The handbook next to it explains every check and what the four levels mean. Anything '
        + 'that looks wrong, send it to me.'],
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

function briefing() {
  return BRIEFING.map(([term, detail]) => `
      <div><dt>${term}</dt><dd>${detail}</dd></div>`).join('');
}

function beats() {
  return BEATS.map((beat, i) => {
    const lines = beat.lines.map(([kind, body]) => {
      const tag = { do: 'Do', say: 'Say', why: 'Why', see: 'See', watch: 'If not' }[kind];
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

const bySeverity = { blocker: 0, major: 0, minor: 0, nit: 0 };
for (const rule of ALL_RULES) bySeverity[rule.severity] += 1;
const familyCount = new Set(ALL_RULES.map((r) => r.category)).size;
const securityChecks = ALL_RULES.filter((r) => r.category === 'Security accuracy').length;

const date = new Date().toISOString().slice(0, 10);
let commit = 'local';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  // a copy built outside a checkout still gets a dated sheet
}

const total = BEATS.reduce((sum, b) => sum + b.mins, 0);
const html = readFileSync(join(here, 'template.html'), 'utf8')
  .replace('__BRIEFING__', briefing())
  .replace('__PREFLIGHT__', preflight())
  .replace('__BEATS_HTML__', beats())
  .replace('__QA__', questions())
  .replace(/__BEATS__/g, String(BEATS.length))
  .replace(/__TOTAL__/g, String(Math.round(total)))
  .replace(/__CHECKS__/g, String(ALL_RULES.length))
  .replace(/__FAMILIES__/g, String(familyCount))
  .replace(/__BLOCKERS__/g, String(bySeverity.blocker))
  .replace(/__MAJORS__/g, String(bySeverity.major))
  .replace(/__MINORS__/g, String(bySeverity.minor))
  .replace(/__NITS__/g, String(bySeverity.nit))
  .replace(/__SECURITY__/g, String(securityChecks))
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
