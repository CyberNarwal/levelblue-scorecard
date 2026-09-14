/**
 * Test suite. Run with: node --test tools/report-qa/
 *
 * The priority here is guarding against false positives. A missed nit is a
 * nuisance; a rule that fires on correct prose gets the whole tool switched off.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { DEFAULT_CONFIG } from './src/config.mjs';
import { loadConfig } from './src/config-node.mjs';
import { parseMarkdown } from './src/document.mjs';
import { ALL_RULES, analyse } from './src/engine.mjs';
import { extractDocx } from './src/extract/docx.mjs';
import { extractPptx } from './src/extract/pptx.mjs';
import { inflateRaw } from './src/extract/inflate.mjs';
import { applyFixes } from './src/fix.mjs';
import { loadDocument } from './src/load.mjs';
import { suffixDialect } from './src/data/dialect.mjs';
import { splitSentences, countWords, matchCase } from './src/text.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-03-15T12:00:00Z');

/** Analyse a markdown string with the default config plus any overrides. */
function check(markdown, overrides = {}) {
  const config = { ...structuredClone(DEFAULT_CONFIG), ...overrides };
  const doc = parseMarkdown(markdown, { source: 'test.md' });
  return { doc, ...analyse(doc, { config, now: NOW }) };
}

const rulesHit = (result) => new Set(result.findings.map((f) => f.rule));
const findingsFor = (result, rule) => result.findings.filter((f) => f.rule === rule);

// ---------------------------------------------------------------- text utils

test('sentence splitting keeps abbreviations and decimals intact', () => {
  const sentences = splitSentences('Patched on 12 Mar. 2026 by Dr. Singh. CVSS 9.8 applies, i.e. critical. Done?');
  assert.equal(sentences.length, 3);
  assert.match(sentences[0].text, /Dr\. Singh\.$/);
  assert.match(sentences[1].text, /i\.e\. critical\.$/);
});

test('sentence offsets point at the real position in the source', () => {
  const source = 'First one. Second one here.';
  const sentences = splitSentences(source);
  assert.equal(source.slice(sentences[1].start, sentences[1].end), 'Second one here.');
});

test('word count ignores punctuation-only tokens', () => {
  assert.equal(countWords('one, two -- three.'), 3);
});

test('matchCase preserves the original capitalisation pattern', () => {
  assert.equal(matchCase('Organisation', 'organization'), 'Organization');
  assert.equal(matchCase('ORGANISATION', 'organization'), 'ORGANIZATION');
  assert.equal(matchCase('organisation', 'organization'), 'organization');
});

// ------------------------------------------------------------ document model

test('markdown parses into the expected block types', () => {
  const doc = parseMarkdown('# H\n\nPara text.\n\n- item one\n- item two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
  const types = doc.blocks.map((b) => b.type);
  assert.deepEqual(types, ['heading', 'paragraph', 'listItem', 'listItem', 'tableRow', 'tableRow']);
});

test('code fences and URLs are opaque to prose rules', () => {
  const doc = parseMarkdown('Text here.\n\n```\nbad  spacing  inside  code\n```\n');
  assert.ok(doc.isOpaque(doc.text.indexOf('bad  spacing')));
  const spaced = check('The command `netsh  advfirewall  show` was run on the host.');
  assert.ok(!rulesHit(spaced).has('whitespace/double-space'), 'must not flag spacing inside inline code');
  const url = check('Refer to https://example.com/path?its=1&affect=2 for the advisory detail.');
  assert.ok(!rulesHit(url).has('language/confusable'), 'must not read prose rules into a URL');
});

// -------------------------------------------------------------------- dialect

test('the -ise/-ize rule spares words that are -ise in both dialects', () => {
  for (const word of ['exercise', 'comprise', 'advertise', 'supervise', 'surprise', 'enterprise', 'compromise', 'revise']) {
    assert.equal(suffixDialect(word), null, `${word} must not be treated as a dialect marker`);
  }
});

test('the -ise/-ize rule still catches real dialect markers', () => {
  assert.equal(suffixDialect('organize').dialect, 'en-US');
  assert.equal(suffixDialect('organise').dialect, 'en-GB');
  assert.equal(suffixDialect('prioritized').dialect, 'en-US');
  assert.equal(suffixDialect('capsize'), null);
});

test('minority spellings are reported against the majority dialect', () => {
  const result = check('The organisation prioritised its defence programme.\n\nThe organization then analyzed the data.\n');
  const findings = findingsFor(result, 'dialect/mixed-spelling');
  assert.ok(findings.length >= 2);
  assert.ok(findings.every((f) => /American spelling/.test(f.message)));
  assert.equal(result.stats.dialect, 'en-GB');
});

test('a consistently American report produces no dialect findings', () => {
  const result = check('The organization analyzed its defense program and prioritized the color coding.');
  assert.deepEqual(findingsFor(result, 'dialect/mixed-spelling'), []);
});

test('ambiguous numeric dates are flagged as ambiguous', () => {
  const result = check('The review completed on 03/04/2026 as agreed.');
  const findings = findingsFor(result, 'dialect/date-format');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /UK reads it as 3 April, US as March 4/);
});

// ----------------------------------------------------------------- whitespace

test('double spaces, trailing space and blank runs are caught', () => {
  const result = check('Alpha  beta here.   \n\n\n\n\nGamma delta text follows on.\n');
  const hit = rulesHit(result);
  assert.ok(hit.has('whitespace/double-space'));
  assert.ok(hit.has('whitespace/trailing'));
  assert.ok(hit.has('whitespace/excess-blank-lines'));
});

test('invisible characters are reported by name', () => {
  const result = check('The host was patched and​checked.');
  const findings = findingsFor(result, 'whitespace/invisible-characters');
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /no-break space/);
});

test('table alignment padding is not reported as double spacing', () => {
  const result = check('| Ref  | Finding   |\n|------|-----------|\n| F-01 | Weak auth |\n');
  assert.deepEqual(findingsFor(result, 'whitespace/double-space'), []);
});

// ---------------------------------------------------------------- punctuation

test('apostrophe plurals are caught but possessives are not', () => {
  const result = check("Three CVE's were found. NIST's guidance is clear on this point.");
  const findings = findingsFor(result, 'punctuation/apostrophe-plural');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /CVE's/);
});

test('repeated words are caught, "that that" is not', () => {
  const result = check('The the server was unpatched. We found that that server was exposed too.');
  const findings = findingsFor(result, 'punctuation/repeated-word');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /"The" is repeated/);
});

test('inconsistent serial commas are reported once, with a count', () => {
  const result = check(
    'We reviewed identity, access, and logging.\n\n'
    + 'We assessed servers, endpoints and firewalls.\n\n'
    + 'The scope was networks, hosts, and applications.\n\n'
    + 'It covered policy, process, and people.\n\n'
    + 'Also email, web and storage.\n',
  );
  const findings = findingsFor(result, 'punctuation/oxford-comma');
  assert.equal(findings.length, 1);
  assert.ok(findings[0].aggregate);
});

test('unbalanced brackets are reported', () => {
  const result = check('The scope (excluding the DMZ was agreed with the client.');
  assert.ok(rulesHit(result).has('punctuation/unbalanced-delimiters'));
});

// --------------------------------------------------------- security accuracy

test('a CVSS score that contradicts its severity word is a blocker', () => {
  const result = check('The flaw is rated High with a CVSS v3.1 score of 9.8 on the perimeter host.');
  const findings = findingsFor(result, 'cyber/cvss-score');
  const mismatch = findings.find((f) => /is "Critical"/.test(f.message));
  assert.ok(mismatch, 'expected a band mismatch finding');
  assert.equal(mismatch.severity, 'blocker');
});

test('a CVSS score that agrees with its severity word is clean', () => {
  const result = check('The flaw is rated Critical with a CVSS v3.1 score of 9.8 on the perimeter host.');
  assert.deepEqual(findingsFor(result, 'cyber/cvss-score'), []);
});

test('malformed CVE identifiers are normalised', () => {
  const result = check('Both cve-2021-44228 and CVE 2023 1234 were reviewed during the assessment.');
  const findings = findingsFor(result, 'cyber/cve-format');
  assert.ok(findings.length >= 2);
  assert.equal(findings[0].suggestion, 'CVE-2021-44228');
});

test('invalid NIST CSF categories are rejected and valid ones accepted', () => {
  const bad = check('The assessment covered DE.XX-02 across the estate.');
  assert.match(findingsFor(bad, 'cyber/csf-identifier')[0].message, /DETECT has no category "XX"/);
  const good = check('The assessment covered GV.OC-01, PR.AA-05 and DE.CM-01 across the estate.');
  assert.deepEqual(findingsFor(good, 'cyber/csf-identifier'), []);
});

test('routable IoCs in malicious context must be defanged, private ranges need not be', () => {
  const result = check('The malicious C2 endpoint 45.155.205.211 contacted the internal host 192.168.4.10.');
  const findings = findingsFor(result, 'cyber/undefanged-ioc');
  assert.equal(findings.length, 1);
  assert.match(findings[0].suggestion, /45\[\.\]155\[\.\]205\[\.\]211/);
});

test('severity labels outside the configured scale are reported', () => {
  const result = check('The finding severity is Severe and requires attention.');
  const findings = findingsFor(result, 'cyber/severity-scale');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].suggestion, 'Critical');
});

// ------------------------------------------------------------------- numbers

test('the same statistic given two values is a blocker', () => {
  const result = check('We identified 14 critical findings.\n\nThe 12 critical findings are listed below.\n');
  const findings = findingsFor(result, 'numbers/contradictory-statistic');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'blocker');
  assert.match(findings[0].message, /14 and 12/);
});

test('a consistent statistic is not reported', () => {
  const result = check('We identified 14 critical findings.\n\nThe 14 critical findings are listed below.\n');
  assert.deepEqual(findingsFor(result, 'numbers/contradictory-statistic'), []);
});

test('a stated breakdown that does not total 100% is reported', () => {
  const result = check('The breakdown of findings was 45% critical, 30% high and 20% medium.');
  assert.ok(rulesHit(result).has('numbers/percentage-total'));
});

test('standard numbers are not mistaken for unformatted quantities', () => {
  const result = check('Our review of ISO 27001 controls covered the full Annex.');
  assert.deepEqual(findingsFor(result, 'numbers/large-number-separator'), []);
});

// ------------------------------------------------------------------ structure

test('placeholder text is a blocker', () => {
  const result = check('Next steps: TBC pending confirmation from [CLIENT NAME].');
  const findings = findingsFor(result, 'structure/placeholder-text');
  assert.ok(findings.length >= 2);
  assert.ok(findings.every((f) => f.severity === 'blocker'));
});

test('overlapping matches from one rule collapse to a single finding', () => {
  const result = check('Confirm with [CLIENT NAME] before issue.');
  const placeholders = findingsFor(result, 'structure/placeholder-text');
  assert.equal(placeholders.length, 1, 'the bracket and the word inside it are one finding');
});

test('unresolved cross-references are reported, resolved ones are not', () => {
  const broken = check('# Intro\n\nSee Figure 4 for the heat map.\n\nFigure 1. Maturity\n');
  assert.ok(rulesHit(broken).has('structure/cross-reference'));
  const fine = check('# Intro\n\nSee Figure 1 for the heat map.\n\nFigure 1. Maturity by function\n');
  assert.deepEqual(findingsFor(fine, 'structure/cross-reference'), []);
});

test('heading level skips are reported', () => {
  const result = check('# One\n\nText body here.\n\n### Three\n\nMore text body here.\n');
  assert.ok(rulesHit(result).has('structure/heading-level-skip'));
});

test('a repeated sentence is flagged as a copy-paste artefact', () => {
  const sentence = 'The organisation has no documented process for reviewing privileged account access rights.';
  const result = check(`${sentence}\n\nSome other text entirely.\n\n${sentence}\n`);
  assert.ok(rulesHit(result).has('structure/duplicate-paragraph'));
});

// ----------------------------------------------------------- confidentiality

test('secrets are blockers and are masked in the output', () => {
  const result = check('The key AKIAIOSFODNN7EXAMPLE was found in the configuration.');
  const findings = findingsFor(result, 'confidentiality/secret');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'blocker');
  assert.ok(!findings[0].excerpt.includes('AKIAIOSFODNN7EXAMPLE'), 'the secret must not be reprinted');
  assert.ok(findings[0].excerpt.includes('configuration'), 'surrounding words stay readable');
});

test('a secret never appears in any excerpt, including a neighbouring finding\'s', () => {
  // The password and the key are close enough that each sits inside the other's
  // context window, so per-finding masking alone would leak both.
  const source = 'The file contained password = Summer2026!Trading and the key AKIAIOSFODNN7EXAMPLE was there too.\n';
  const result = check(source);
  assert.ok(findingsFor(result, 'confidentiality/secret').length >= 2, 'precondition: both secrets detected');
  for (const finding of result.findings) {
    const excerpt = finding.excerpt || '';
    assert.ok(!excerpt.includes('AKIAIOSFODNN7EXAMPLE'), `${finding.rule} reprinted the access key`);
    assert.ok(!excerpt.includes('Summer2026!Trading'), `${finding.rule} reprinted the password`);
  }
});

test("another client's name in the draft is a blocker", () => {
  const result = check('This assessment for Contoso Ltd reviewed the estate.', { forbiddenClientNames: ['Contoso'] });
  const findings = findingsFor(result, 'confidentiality/wrong-client');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'blocker');
});

test('role email addresses are allowed, named individuals are flagged', () => {
  const result = check('Contact security@example.com or jane.doe@example.com for detail.');
  const findings = findingsFor(result, 'confidentiality/personal-data');
  assert.equal(findings.length, 1);
  assert.ok(findings[0].excerpt.includes('security@example.com'));
});

// -------------------------------------------------------------------- engine

test('inline comments suppress a rule on the following line', () => {
  const noisy = check('Alpha  beta gamma delta.\n');
  assert.ok(rulesHit(noisy).has('whitespace/double-space'));
  const quiet = check('<!-- qa-disable whitespace/double-space -->\nAlpha  beta gamma delta.\n');
  assert.ok(!rulesHit(quiet).has('whitespace/double-space'));
});

test('a category prefix suppresses every rule beneath it', () => {
  const result = check('<!-- qa-disable whitespace -->\nAlpha  beta gamma delta.   \n');
  assert.ok(![...rulesHit(result)].some((r) => r.startsWith('whitespace/')));
});

test('config can disable or re-grade a rule', () => {
  const off = check('Alpha  beta gamma.', { rules: { 'whitespace/double-space': 'off' } });
  assert.ok(!rulesHit(off).has('whitespace/double-space'));
  const graded = check('Alpha  beta gamma.', { rules: { 'whitespace/double-space': 'blocker' } });
  assert.equal(findingsFor(graded, 'whitespace/double-space')[0].severity, 'blocker');
});

test('no rule throws on an empty or minimal document', () => {
  for (const input of ['', '\n', '# Only a heading\n', 'x', '|||\n']) {
    const result = check(input);
    assert.deepEqual(result.errors, [], `rule errors on input ${JSON.stringify(input)}`);
  }
});

test('every rule is well formed: unique id, severity, category, check', () => {
  const seen = new Set();
  for (const rule of ALL_RULES) {
    assert.ok(!seen.has(rule.id), `duplicate rule id: ${rule.id}`);
    seen.add(rule.id);
    assert.match(rule.id, /^[a-z]+\/[a-z-]+$/, `bad id shape: ${rule.id}`);
    assert.ok(['blocker', 'major', 'minor', 'nit'].includes(rule.severity), `bad severity on ${rule.id}`);
    assert.ok(rule.title && rule.category, `missing metadata on ${rule.id}`);
    assert.equal(typeof rule.check, 'function', `missing check on ${rule.id}`);
  }
  assert.ok(ALL_RULES.length >= 50, `expected a substantial rule set, got ${ALL_RULES.length}`);
});

test('config validation rejects bad values', () => {
  assert.throws(() => loadConfig({ overrides: { dialect: 'en-AU' } }), /dialect must be/);
  assert.throws(() => loadConfig({ overrides: { failOn: 'catastrophic' } }), /failOn must be/);
  assert.throws(() => loadConfig({ overrides: { rules: { 'a/b': 'loud' } } }), /must be "off" or a severity/);
});

// ----------------------------------------------------------------------- fix

test('fixes apply cleanly and leave the document better than before', () => {
  const source = 'The  host was  patched .\n\nThe the review is complete now.\n';
  const first = check(source);
  const { text, applied } = applyFixes(first.doc, first.findings);
  assert.ok(applied.length >= 3);
  assert.ok(!text.includes('  '), 'double spaces are gone');
  assert.ok(!text.includes(' .'), 'space before full stop is gone');
  assert.ok(!/\bThe the\b/.test(text), 'repeated word is gone');

  const second = check(text);
  assert.ok(second.findings.length < first.findings.length, 'fixing must reduce findings');
});

test('fixes never overlap or corrupt surrounding text', () => {
  const source = 'Alpha  beta  gamma  delta and the the end.\n';
  const result = check(source);
  const { text } = applyFixes(result.doc, result.findings);
  assert.equal(text, 'Alpha beta gamma delta and the end.\n');
});

test('--fix never rewrites inside a credential', () => {
  const source = 'The configuration file contained password = Summer2026!Trading for the service account.\n';
  const result = check(source);
  assert.ok(rulesHit(result).has('confidentiality/secret'), 'precondition: the secret is detected');
  const { text, skipped } = applyFixes(result.doc, result.findings);
  assert.ok(text.includes('Summer2026!Trading'), 'the credential value must not be altered by a fix');
  assert.ok(skipped.some((s) => s.reason === 'inside a span flagged as sensitive'));
});

test('only high-confidence findings are auto-fixed', () => {
  const result = check('The window is 2020-2024 for this review.');
  const dash = findingsFor(result, 'punctuation/dash-style')[0];
  assert.equal(dash.confidence, 'medium');
  const { applied } = applyFixes(result.doc, result.findings);
  assert.ok(!applied.some((a) => a.rule === 'punctuation/dash-style'));
});

// ---------------------------------------------------------------------- docx

test('DOCX extraction recovers structure and editorial residue', () => {
  const buffer = readFileSync(join(here, 'samples', 'sample-draft.docx'));
  const { paragraphs, meta } = extractDocx(buffer);

  assert.ok(paragraphs.some((p) => p.type === 'heading' && p.text === 'Executive Summary'));
  assert.ok(paragraphs.some((p) => p.type === 'listItem'));
  assert.ok(paragraphs.some((p) => p.type === 'tableRow' && p.cells.includes('Critical')));
  assert.ok(paragraphs.filter((p) => p.type === 'blank').length >= 3, 'empty paragraphs are preserved');

  assert.equal(meta.trackedInsertions, 1);
  assert.equal(meta.comments.length, 1);
  assert.equal(meta.comments[0].author, 'A. Reviewer');
  assert.equal(meta.highlights.length, 1);
  assert.ok(meta.headerFooterText.some((t) => t.includes('CONFIDENTIAL')));
  assert.match(meta.title, /Contoso/);
});

test('DOCX release-readiness rules fire on the fixture', () => {
  const doc = loadDocument(join(here, 'samples', 'sample-draft.docx'));
  const result = analyse(doc, { config: structuredClone(DEFAULT_CONFIG), now: NOW });
  const hit = rulesHit(result);
  assert.ok(hit.has('confidentiality/tracked-changes'));
  assert.ok(hit.has('confidentiality/unresolved-comments'));
  assert.ok(hit.has('confidentiality/leftover-highlighting'));
  assert.deepEqual(result.errors, []);
});

test('stacked empty paragraphs in DOCX are reported as excess white space', () => {
  const doc = loadDocument(join(here, 'samples', 'sample-draft.docx'));
  const result = analyse(doc, { config: structuredClone(DEFAULT_CONFIG), now: NOW });
  const findings = findingsFor(result, 'whitespace/excess-blank-lines');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /empty paragraphs in a row/);
});

test('document metadata naming a different client is reported', () => {
  const doc = loadDocument(join(here, 'samples', 'sample-draft.docx'));
  const config = { ...structuredClone(DEFAULT_CONFIG), forbiddenClientNames: ['Contoso'] };
  const result = analyse(doc, { config, now: NOW });
  const findings = findingsFor(result, 'confidentiality/document-metadata');
  assert.ok(findings.some((f) => /Contoso/.test(f.message)));
});

test('a PDF is refused with a useful message rather than mis-parsed', () => {
  assert.throws(() => loadDocument('nonexistent.pdf'), /PDF is not supported/);
});

// --------------------------------------------------------- false-positive net

test('clean, well-written UK prose produces no findings above minor', () => {
  const clean = [
    '# Executive summary',
    '',
    'Northwind engaged LevelBlue to assess its security posture against NIST CSF 2.0.',
    'The assessment ran from 2 March 2026 to 12 March 2026 and covered 240 hosts.',
    '',
    '## Recommendations',
    '',
    '- Deploy multi-factor authentication (MFA) to all 47 administrative accounts within 30 days.',
    '- Decommission the four unsupported servers identified by the IT team by Q3 2026.',
    '',
  ].join('\n');
  const result = check(clean, { dialect: 'en-GB' });
  const serious = result.findings.filter((f) => f.severity === 'blocker' || f.severity === 'major');
  assert.deepEqual(
    serious.map((f) => `${f.rule}: ${f.message}`),
    [],
    'clean prose must not produce blockers or majors',
  );
});

// ---------------------------------------------------------------------- pptx

/** Analyse the deck fixture with the given config overrides. */
function checkDeck(overrides = {}) {
  const doc = loadDocument(join(here, 'samples', 'sample-deck.pptx'));
  const config = { ...structuredClone(DEFAULT_CONFIG), ...overrides };
  return { doc, ...analyse(doc, { config, now: NOW }) };
}

test('PPTX extraction recovers slides, titles, bullets, tables and notes', () => {
  const buffer = readFileSync(join(here, 'samples', 'sample-deck.pptx'));
  const { paragraphs, meta } = extractPptx(buffer);

  assert.equal(meta.slideCount, 5);
  assert.equal(meta.slides[0].title, 'Cyber Security Posture Review');
  assert.equal(meta.slides[1].title, 'Executive Summary');
  assert.ok(paragraphs.some((p) => p.type === 'listItem' && p.slide === 2));
  assert.ok(paragraphs.some((p) => p.type === 'tableRow' && p.slide === 5 && p.cells.includes('Critical')));
  assert.ok(paragraphs.some((p) => p.type === 'notes' && p.slide === 2));
  assert.equal(meta.notes.length, 1);
  assert.equal(meta.notes[0].slide, 2);
  assert.equal(meta.comments.length, 1);
  assert.equal(meta.comments[0].author, 'A. Reviewer');
  assert.ok(meta.templateText.some((t) => /Contoso/.test(t.text)));
});

test('slide order follows the presentation part, not file names', () => {
  const { meta } = extractPptx(readFileSync(join(here, 'samples', 'sample-deck.pptx')));
  assert.deepEqual(meta.slides.map((s) => s.number), [1, 2, 3, 4, 5]);
});

test('every finding in a deck is located by slide, not by line', () => {
  const result = checkDeck();
  const located = result.findings.filter((f) => !f.documentLevel);
  assert.ok(located.length > 0);
  assert.ok(located.every((f) => typeof f.slide === 'number'), 'every non-document finding names a slide');
  assert.ok(result.findings.filter((f) => f.documentLevel).every((f) => f.slide === undefined));
});

test('internal remarks in speaker notes are a blocker naming the slide', () => {
  const findings = findingsFor(checkDeck(), 'slides/internal-content-in-notes');
  assert.ok(findings.length >= 3);
  assert.ok(findings.every((f) => f.severity === 'blocker'));
  assert.ok(findings.some((f) => /day rate/.test(f.message)));
  assert.ok(findings.every((f) => f.slide === 2 && f.region === 'notes'));
});

test("PowerPoint's own prompt text left on a slide is a blocker", () => {
  const findings = findingsFor(checkDeck(), 'slides/layout-prompt-text');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].slide, 4);
  assert.equal(findings[0].severity, 'blocker');
});

test("another client's name hidden in the slide layouts is caught", () => {
  const clean = findingsFor(checkDeck(), 'slides/template-leakage');
  assert.deepEqual(clean, [], 'nothing to report until the names are configured');
  const findings = findingsFor(checkDeck({ forbiddenClientNames: ['Contoso'] }), 'slides/template-leakage');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /slideLayouts/);
});

test('deck density, titles and bullet depth are reported per slide', () => {
  const result = checkDeck();
  assert.equal(findingsFor(result, 'slides/text-density')[0].slide, 2);
  assert.equal(findingsFor(result, 'slides/missing-title')[0].slide, 3);
  assert.equal(findingsFor(result, 'slides/bullet-depth')[0].slide, 2);
  assert.equal(findingsFor(result, 'slides/duplicate-title')[0].slide, 5);
});

test('slide rules stay silent on documents, and document rules on decks', () => {
  const markdown = check('# Heading one\n\nSome ordinary prose here for the check.\n');
  assert.ok(![...rulesHit(markdown)].some((r) => r.startsWith('slides/')), 'no slide rules on a document');
  const deck = checkDeck();
  assert.ok(!rulesHit(deck).has('confidentiality/unresolved-comments'), 'the Word comment rule defers to slides/comments');
  assert.deepEqual(deck.errors, []);
});

test('spelling and security rules still apply to slide text', () => {
  const hit = rulesHit(checkDeck({ dialect: 'en-GB' }));
  assert.ok(hit.has('dialect/mixed-spelling'), 'American spellings on a slide are still reported');
  assert.ok(hit.has('terminology/canonical-name'), 'terminology rules still apply');
});

test('legacy .ppt is refused with a useful message', () => {
  assert.throws(() => loadDocument('deck.ppt'), /Save as \.pptx/);
});

// ------------------------------------------------------------------- inflate

test('the DEFLATE decoder matches zlib across block types and levels', async () => {
  const { deflateRawSync, inflateRawSync } = await import('node:zlib');
  const cases = [
    Buffer.alloc(0),
    Buffer.from('a'),
    Buffer.from('abcabcabc'.repeat(400)),
    Buffer.alloc(120000, 65),
    readFileSync(join(here, 'samples', 'sample-deck.pptx')),
  ];
  for (const data of cases) {
    for (const level of [0, 1, 6, 9]) {
      const packed = deflateRawSync(data, { level });
      assert.deepEqual(
        Buffer.from(inflateRaw(packed)),
        inflateRawSync(packed),
        `mismatch at level ${level} for ${data.length} bytes`,
      );
    }
  }
});
