/**
 * Build the team handbook for the offline QA page.
 *
 * The check list is generated from the rules themselves rather than written out
 * by hand, because a handbook that disagrees with the tool is worse than none:
 * a reviewer who finds one wrong entry stops trusting the rest of it.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_RULES } from './src/engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const SEVERITIES = ['blocker', 'major', 'minor', 'nit'];

const LEVELS = {
  blocker: {
    name: 'Blocker',
    gist: 'Must not reach a client at all.',
    detail: 'A credential, another client’s name, an unresolved comment, a tracked change, '
      + 'an internal remark in the speaker notes. Fix before the draft leaves the building.',
  },
  major: {
    name: 'Major',
    gist: 'Wrong, or reads as wrong to the client.',
    detail: 'A missing section, a cross-reference that goes nowhere, a CVSS score that '
      + 'contradicts its own label, an acronym never expanded.',
  },
  minor: {
    name: 'Minor',
    gist: 'The draft disagrees with itself.',
    detail: 'Spelling, capitalisation, dashes, spacing. Each one is small; together they are '
      + 'what makes a report look unchecked.',
  },
  nit: {
    name: 'Nit',
    gist: 'A preference rather than a fault.',
    detail: 'Wordiness, hedging, passive voice. Fix if you have the time, ignore it if you do not.',
  },
};

function escape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function rulesByCategory() {
  const grouped = new Map();
  for (const rule of ALL_RULES) {
    if (!grouped.has(rule.category)) grouped.set(rule.category, []);
    grouped.get(rule.category).push(rule);
  }
  return [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
}

function checkTables() {
  return rulesByCategory().map(([category, rules]) => {
    const rows = rules.map((rule) => `
            <tr>
              <td><span class="sev ${rule.severity}">${LEVELS[rule.severity].name}</span></td>
              <td>${escape(rule.title)}</td>
              <td><code>${escape(rule.id)}</code></td>
            </tr>`).join('');
    return `
        <section class="family">
          <h3>${escape(category)} <span class="tally">${rules.length}</span></h3>
          <div class="scroller">
            <table>
              <thead><tr><th>Level</th><th>What it looks for</th><th>Rule</th></tr></thead>
              <tbody>${rows}
              </tbody>
            </table>
          </div>
        </section>`;
  }).join('');
}

function build() {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, ALL_RULES.filter((r) => r.severity === s).length]));
  const families = rulesByCategory().length;
  const date = new Date().toISOString().slice(0, 10);
  let commit = 'local';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    // A copy built outside a checkout still gets a dated handbook.
  }

  const template = readFileSync(join(here, 'manual', 'template.html'), 'utf8');
  const html = template
    .replace('__CHECK_TABLES__', checkTables())
    .replace(/__TOTAL__/g, String(ALL_RULES.length))
    .replace(/__FAMILIES__/g, String(families))
    .replace(/__BLOCKERS__/g, String(counts.blocker))
    .replace(/__MAJORS__/g, String(counts.major))
    .replace(/__MINORS__/g, String(counts.minor))
    .replace(/__NITS__/g, String(counts.nit))
    .replace(/__DATE__/g, date)
    .replace(/__COMMIT__/g, commit);

  assertSelfContained(html);

  const out = join(root, 'report-qa-handbook.html');
  writeFileSync(out, html);
  console.log(`Built ${out}`);
  console.log(`  ${ALL_RULES.length} checks in ${families} families `
    + `(${counts.blocker} blocker, ${counts.major} major, ${counts.minor} minor, ${counts.nit} nit)`);
  console.log(`  version ${date} (${commit}), ${Math.round(html.length / 1024)} kB`);
}

/**
 * The handbook's own subject is a tool that touches no network, so the handbook
 * cannot quietly fetch a webfont, a script or an image when someone opens it.
 * A font link is the easy way for that to creep back in, so the build refuses
 * to emit a page carrying one rather than trusting anyone to remember.
 */
function assertSelfContained(html) {
  const offences = [
    [/<link\b[^>]*\bhref=["']https?:/i, 'a link to an external stylesheet or font'],
    [/<script\b[^>]*\bsrc=["']https?:/i, 'an external script'],
    [/<img\b[^>]*\bsrc=["']https?:/i, 'an externally hosted image'],
    [/@import\s+url\(["']?https?:/i, 'a CSS @import over the network'],
    [/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket/, 'a network call'],
  ];
  const found = offences.filter(([pattern]) => pattern.test(html)).map(([, what]) => what);
  if (found.length) {
    throw new Error(`The handbook must be self-contained, but it carries ${found.join(', ')}.`);
  }
}

build();
