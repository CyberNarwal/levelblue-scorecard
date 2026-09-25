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

const bySeverity = { blocker: 0, major: 0, minor: 0, nit: 0 };
for (const rule of ALL_RULES) bySeverity[rule.severity] += 1;
const familyCount = new Set(ALL_RULES.map((r) => r.category)).size;
const securityChecks = ALL_RULES.filter((r) => r.category === 'Security accuracy').length;

/** What to have in your head, rather than what to do. */
const BRIEFING = [
  ['What it is',
   `A rule engine in one HTML file. <b>${ALL_RULES.length} checks</b> across <b>${familyCount} families</b>, `
   + `split <b>${bySeverity.blocker} blocker, ${bySeverity.major} major, ${bySeverity.minor} minor, `
   + `${bySeverity.nit} nit</b>.`],
  ['Why rules, not AI',
   'Because a QA tool has to be trusted before it is clever. A rule either matched or it did not, '
   + 'so every finding traces back to a named check and the same draft checked twice gives the same '
   + 'answer. That is what lets someone argue with it.'],
  ['How it stays offline',
   'No upload, no server, no account, no telemetry. The build <b>refuses to produce the file</b> if '
   + 'it contains a network call or a link to anything outside itself. Unplug the network and it '
   + 'behaves identically.'],
  ['What it reads',
   '<b>.pptx</b> — slides, speaker notes, comments, tables, layouts and masters. '
   + '<b>.docx</b> — text, tracked changes, comments, highlighting, headers, footers, properties. '
   + 'Also .md and .html. It refuses .pdf on purpose, because text pulled out of a PDF garbles and '
   + 'it would invent faults.'],
  ['The one sentence',
   'If they remember nothing else: <b>it clears the mechanical faults so the read you do next is '
   + 'spent on the argument.</b> A clean result is not sign-off.'],
];

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
 * Each beat is a run of blocks read top to bottom. `act` is something you do,
 * `say` is something you say, `aside` and `trouble` are small notes to the
 * side, `pause` is a reminder to stop talking. No labels and no columns: a
 * presenter cannot decode a table while they are speaking.
 */
const BEATS = [
  {
    title: 'Open on the problem, not the tool',
    mins: 1,
    script: [
      ['say', 'Every draft we send gets read before it goes out. That read is doing two jobs at '
        + 'once. Is the argument right, and is the document clean. The second job is the one that '
        + 'goes badly at five o\'clock on a Friday, and it is the one a machine can do perfectly '
        + 'every single time.'],
      ['say', 'So we run this first, and then you read it. One file. Nothing to install, nothing to '
        + 'log into, and nothing about the draft goes anywhere.'],
      ['act', 'Point at the address bar.'],
      ['say', 'That is a file path, not a web address. There is no server behind this. If anyone '
        + 'asks you later whether client material is being sent somewhere — that is your answer. '
        + 'And it is not just a promise: the thing that builds this file refuses to produce it at '
        + 'all if it contains a single network call.'],
    ],
  },
  {
    title: 'Drop the draft in and let it talk',
    mins: 1,
    script: [
      ['act', 'Drag the demo draft onto the page. Do not fill anything in first.'],
      ['say', 'Four slides. In about a second it has read every slide, every speaker note, the '
        + 'tables, the slide layouts, the master behind them, and the file\'s own properties. '
        + `And it says do not send it — ${blank.stats.bySeverity.blocker} things here must not reach a client.`],
      ['say', 'Worth noticing where it just looked. Nobody proofreads a slide master. That is '
        + 'exactly where the worst thing in this deck is hiding, and I will come back to it.'],
      ['aside', `You will see <b>Do not send this yet</b>, ${blank.stats.bySeverity.blocker} blockers, `
        + `${blank.stats.total} findings.`],
      ['trouble', 'Nothing happened? The file is probably still downloading. Check the status line '
        + 'under the drop zone.'],
    ],
  },
  {
    title: 'The one nobody ever sees',
    mins: 2,
    script: [
      ['act', 'Open <b>Internal remarks in the speaker notes</b>.'],
      ['say', 'These are in the speaker notes. Nobody put them on a slide, so nobody finds them by '
        + 'flicking through the deck. But they travel inside the file. You send this, the client '
        + 'opens it, and they can read every one of them.'],
      ['say', 'And look at what it is matching. Not swearing. Commercial phrasing. '
        + '<em>Day rate. Push them for more. Guesstimate.</em> The things we write to each other, '
        + 'which read very differently to the person paying the invoice.'],
      ['say', 'Exporting to PDF would strip these out. We almost never send PDFs.'],
      ['pause', 'Stop talking here. Let them read it.'],
    ],
  },
  {
    title: 'A number arguing with itself',
    mins: 1,
    script: [
      ['act', 'Open <b>CVSS score problem</b>.'],
      ['say', 'The deck says the score is 9.1 and calls it Medium. One of those is wrong. It is '
        + 'reading the score, looking up which band 9.1 actually falls in, and comparing that to '
        + 'the severity word sitting next to it.'],
      ['say', 'This is the kind of thing that does real damage, because it is not a typo. A client '
        + 'who checks one number and finds it wrong now has a reason to check all of them. '
        + `There are ${n(securityChecks)} checks like this one — CVE formats, ATT&CK technique IDs, `
        + 'NIST CSF identifiers, and whether the framework version you are citing is still current.'],
    ],
  },
  {
    title: 'Four boxes, and the finding nobody could have caught',
    mins: 3,
    script: [
      ['act', 'Open <b>Engagement settings</b>. Put in <code>Northwind Trading</code>, then '
        + '<code>Contoso, Initech</code>, then <code>CONFIDENTIAL</code>.'],
      ['say', 'These four describe the engagement rather than the file. They are remembered on your '
        + 'machine and they apply to everything you check until you change them.'],
      ['act', 'Drop the same file on again.'],
      ['say', `Same deck. Now it is ${filled.stats.total} findings and `
        + `${filled.stats.bySeverity.blocker} blockers, and the new one is this.`],
      ['say', '<em>Contoso appears in the deck\'s slide masters.</em> That name is in the template '
        + 'behind the slides. You will not find it by reading the deck, scrolling the deck, or '
        + 'printing the deck. It is the previous client, sitting in the file somebody copied to '
        + 'make this one.'],
      ['say', 'Which is how it always happens. You open last quarter\'s deck, save as, replace the '
        + 'slides. The master keeps whatever was in it.'],
      ['say', 'This is the one I would not have caught by eye. It is also the most damaging thing on '
        + 'the list, because it is not a mistake in the writing — it is evidence to one client that '
        + 'we recycle another client\'s material.'],
      ['say', 'That is what those four boxes buy you. Thirty seconds.'],
      ['aside', 'The settings also unlocked two more: the missing <b>CONFIDENTIAL</b> marking, and the '
        + "deck's own author property, which still reads <b>Contoso Financial Services</b>. Same "
        + 'principle — it cannot check a name you have not told it to watch for.'],
      ['trouble', 'Count did not change? The settings did not save. Re-open the panel and check the '
        + 'button now reads <b>for Northwind Trading</b>.'],
    ],
  },
  {
    title: 'What a finding actually hands you',
    mins: 1,
    script: [
      ['act', 'Scroll to one of the spelling findings on slide 2.'],
      ['say', 'It quotes your own sentence back with the problem highlighted, and puts the '
        + 'replacement on the right. Not a line number and a rule name to go hunting with — the '
        + 'actual words, so you can match it to what is on your screen in front of you.'],
      ['say', 'It highlights spaces too. A highlighted blank is the only way you can see a double '
        + 'space at all.'],
      ['say', 'And it groups them. One check firing eight times is one row with a count and a '
        + 'preview of the words, not eight rows saying the same thing.'],
    ],
  },
  {
    title: 'You get the last word',
    mins: 1,
    script: [
      ['act', 'Hover a check and click <b>Ignore check</b>, then scroll to the bottom.'],
      ['say', 'No rule set is right about everything. When it is wrong, you set it aside. The '
        + 'important part is that it never just disappears — it is counted, it is listed down here '
        + 'with a Restore next to it, and every format you copy out says how many were left out.'],
      ['say', 'Because a QA pass whose exclusions are invisible is one nobody can check. Including '
        + 'you, six months later, when someone asks why a finding was not actioned.'],
      ['say', 'And please do not change good writing to satisfy a rule. If a check is wrong often, '
        + 'tell me and I will fix the check.'],
      ['act', 'Click <b>Restore all</b> before you move on.'],
    ],
  },
  {
    title: 'Getting it back to whoever wrote it',
    mins: 1,
    script: [
      ['act', 'Click <b>For comments</b>, then paste into anything. Notepad is fine.'],
      ['say', 'One block per finding. Where it is, what is wrong, the exact words, and the fix. '
        + 'That is what goes into a comment next to the slide it belongs to.'],
      ['act', 'Point at <b>Summary</b> and <b>Blocker list</b> without clicking.'],
      ['say', 'Summary is one line per finding with the blockers first — that is your mail back to '
        + 'the consultant. Blocker list is only what stops it going out, which is the go/no-go note. '
        + 'All of them quote the words, because <em>line 42 has an American spelling</em> sends '
        + 'somebody hunting and <em>found: color</em> does not.'],
    ],
  },
  {
    title: 'The bit that used to take an hour',
    mins: 2,
    script: [
      ['act', 'Click <b>Download deck with comments</b>, then open the downloaded file in PowerPoint.'],
      ['say', `A copy of the deck, carrying ${filled.findings.length} real PowerPoint comments, each one on `
        + 'the slide it came from. The consultant opens this, works down the comment pane, and '
        + 'resolves them as they go.'],
      ['say', 'This is the part that used to cost the most time — reading a QA report on one screen '
        + 'and retyping every point into the deck on the other.'],
      ['say', 'And it is a copy. The file you dropped in is read and never written to. Comments '
        + 'already in the deck are kept, with whoever wrote them. Run it twice and the second pass '
        + 'adds to the first rather than replacing it.'],
      ['aside', 'Word does not do this yet. Word anchors comments to exact runs of text rather than '
        + 'to a page, which is a harder problem. For Word, use the copy formats.'],
      ['trouble', 'PowerPoint offers to repair the file? Do not fight it in front of people. Close '
        + 'it, say the annotated copy is the newest part of the tool, carry on with the copy '
        + 'formats, and tell Rajan afterwards.'],
    ],
  },
  {
    title: 'What it cannot do, and why that matters',
    mins: 1.5,
    script: [
      ['say', 'Everything you have just seen is mechanical. It cannot tell you whether a finding is '
        + 'right. It cannot tell you whether a severity is justified, or whether the remediation '
        + 'advice would actually work. It cannot read a screenshot or a diagram. It has no idea who '
        + 'the client is, what we promised them, or what the politics of the engagement are.'],
      ['say', 'So a clean result is <em>not</em> sign-off. What it does is clear the noise, so that '
        + 'the read you do next is spent on the argument instead of on typos. That read is still '
        + 'yours, and it is the half that actually protects the client.'],
      ['pause', 'Say this one slowly, and say it even if you are running short. It is the thing you '
        + 'most want them to leave with.'],
    ],
  },
  {
    title: 'Where to get it',
    mins: 0.5,
    script: [
      ['act', 'Show the version stamp at the foot of the tool.'],
      ['say', 'It is on SharePoint next to the handbook. Save the file, open it whenever. When I '
        + 'update the checks I replace that one file and you pick it up next time you open it — the '
        + 'version is printed at the bottom so you can tell which copy you have.'],
      ['say', 'The handbook explains every check and what the four levels mean. Anything that looks '
        + 'wrong to you, send it to me.'],
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
    const body = beat.script.map(([kind, text]) => {
      if (kind === 'act') return `\n        <p class="act">${text}</p>`;
      if (kind === 'aside') return `\n        <p class="aside">${text}</p>`;
      if (kind === 'trouble') return `\n        <p class="aside trouble"><b>If it goes wrong.</b> ${text}</p>`;
      if (kind === 'pause') return `\n        <p class="pause">${text}</p>`;
      return `\n        <p>${text}</p>`;
    }).join('');
    return `
    <article class="beat">
      <div class="beat-head">
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <h3>${beat.title}</h3>
        <span class="mins">${beat.mins < 1 ? '30 sec' : `${beat.mins} min`}</span>
      </div>
      <div class="script">${body}
      </div>
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
