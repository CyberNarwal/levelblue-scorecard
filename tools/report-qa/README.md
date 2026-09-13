# report-qa

Mechanical QA for cyber advisory report drafts. Zero dependencies, pure Node.

This is the deterministic half of the report QA agent. It catches everything a
rule can catch, so the reviewing agent (`.claude/skills/report-qa/`) can spend
its attention on the things a rule cannot: whether the argument holds, whether
the severity is justified, whether the remediation advice is actually correct.

```bash
npm run qa -- path/to/draft.docx          # check a draft
npm run qa -- draft.md --fix              # apply the unambiguous corrections
npm run qa:rules                          # list every rule
npm run qa:test                           # run the test suite
```

## What it reads

| Format | Support |
|---|---|
| `.md`, `.txt` | Full, including `--fix` |
| `.docx` | Full, read-only. Also reads tracked changes, comments, highlighting, headers, footers and document properties |
| `.html` | Converted to text, read-only |
| `.pdf` | **Refused on purpose.** Text extraction from PDF is unreliable enough that QA on the result is worse than no QA. Check the source document |

## Severities

| | Meaning |
|---|---|
| `blocker` | Must not reach a client. Secrets, another client's name, placeholder text, contradictory statistics, a CVSS score that disagrees with its severity label, unresolved comments or tracked changes |
| `major` | Wrong, or reads as wrong. Dialect inconsistency, malformed identifiers, missing space after punctuation, unresolved cross-references |
| `minor` | Inconsistent. Serial commas, dash style, heading case, unit spacing |
| `nit` | Preference. Wordiness, hedging, trailing whitespace |

`--fail-on` (default `major`) sets the exit code, so this drops into a
pre-commit hook or CI unchanged. Exit 0 clean, 1 findings at or above the
threshold, 2 could not run.

## What it checks

92 rules in nine families. `npm run qa:rules` prints the current list.

- **Spacing** - double spaces, trailing whitespace, stacked blank lines (and
  stacked empty paragraphs in Word), invisible characters pasted in from Word or
  a vendor portal, space before punctuation, missing space after it, empty
  bullets and table cells.
- **Punctuation and typography** - straight vs curly quotes, apostrophe plurals
  (`CVE's`), hyphen used where an en or em dash belongs, mixed dash conventions,
  stacked punctuation, unbalanced brackets, serial-comma consistency, bullet
  terminators, comma splices, repeated words.
- **Dialect** - British/American consistency in both directions, with the
  exception lists that stop "exercise" and "comprise" being mistaken for
  American spellings. Also date formats, ambiguous numeric dates (`03/04/2026`),
  abbreviation punctuation, and `data is` vs `data are`.
- **Terminology** - canonical vendor, product and standard names; acronyms
  expanded on first use, not re-expanded, not defined and abandoned; the same
  term capitalised two ways; first-person voice against house style.
- **Security accuracy** - CVE format and plausible year, CVSS range, version and
  band-versus-label agreement, MITRE ATT&CK technique format, NIST CSF 2.0
  identifier validity, withdrawn ISO/IEC 27001:2013 control numbering, severity
  labels off the configured scale, undefanged live indicators of compromise,
  risk statements with no business consequence, recommendations with no owner or
  timeframe.
- **Numbers** - the same statistic given two different values, breakdowns that
  do not total 100%, unit and currency formatting, numbers written twice, past
  tense with a future date.
- **Structure** - heading level skips, duplicate and empty sections, heading
  case consistency, required sections, unresolved cross-references, figure and
  table numbering, repeated sentences, single-item lists, mixed bullet markers,
  placeholder text, insecure and unreachable links, ragged table rows.
- **Language** - sentence and paragraph length, Flesch reading ease on the
  executive summary, passive voice (weighted in recommendations), hedging
  density, unsupportable absolute claims, wordiness, vague quantifiers where a
  number belongs, confusable words, repeated sentence openers, tense drift.
- **Confidentiality and release readiness** - credentials and secrets, another
  client's name, missing or conflicting classification markings, internal-only
  content in a client deliverable, tracked changes, unresolved comments,
  leftover highlighting, document properties naming the wrong engagement,
  personal data.

## Configuration

`report-qa.config.json` at the repo root, or the nearest one above the draft.
Override with `--config`. Every field is optional; the defaults are the
opinionated ones.

```json
{
  "dialect": "en-GB",
  "audience": "client",
  "organisation": "LevelBlue",
  "client": { "name": "Northwind Trading", "aliases": ["Northwind"] },
  "forbiddenClientNames": ["Contoso", "Initech"],
  "classification": "CONFIDENTIAL",
  "severityScale": ["Critical", "High", "Medium", "Low", "Informational"],
  "houseStyle": { "oxfordComma": false, "headingCase": "sentence", "dashStyle": "spaced-en" },
  "rules": { "language/wordiness": "off", "structure/bare-url": "nit" },
  "failOn": "major"
}
```

`"auto"` on a house-style setting means "infer the majority usage from the draft
and report the minority". That is usually what you want: the tool does not care
which convention a report uses, only that it holds one.

`forbiddenClientNames` is worth filling in. Template leakage is the most common
confidentiality failure in consulting and the hardest to spot by reading.

### Per-draft exceptions

```markdown
<!-- qa-disable terminology/canonical-name -->
The then Azure AD tenancy was migrated in 2023.
```

A comment disables the named rules for its own line and the next. A category
prefix (`qa-disable whitespace`) disables everything beneath it; `qa-disable all`
disables the lot.

## Design notes

**False positives are the failure mode.** A missed nit is a nuisance; a rule
that fires on correct prose gets the whole tool switched off, and then the
blockers go unseen too. So: prose rules never look inside code, URLs, file
paths, hashes or IP addresses; consistency rules report the minority usage once
with a count rather than flagging every instance; and the dialect rule carries
explicit exception lists rather than trusting a suffix pattern. Every rule in
the test suite has a test that it stays quiet on correct input, not just a test
that it fires.

**Everything is offsets.** Extractors for Markdown, DOCX and HTML all produce
the same `Document` - one normalised string plus blocks with absolute offsets -
so no rule needs to know what the draft was authored in, and `--fix` can apply
edits back-to-front without invalidating positions.

**The core is environment-agnostic.** `src/` uses no Node APIs except in
`extract/docx.mjs` (zlib) and `load.mjs` (fs), so the engine can be imported
into the browser app later without a rewrite.

## Layout

```
cli.mjs                    argument parsing, output, exit codes
src/engine.mjs             runs rules, suppresses, de-duplicates, sorts
src/document.mjs           the Document model and the Markdown parser
src/config.mjs             defaults, merge, validation
src/load.mjs               format detection and dispatch
src/fix.mjs                back-to-front application of safe corrections
src/report.mjs             text, Markdown and JSON output
src/text.mjs               offsets, sentence splitting, readability
src/extract/docx.mjs       zero-dependency ZIP + WordprocessingML reader
src/data/                  dialect pairs, security terms, writing-quality lists
src/rules/                 the nine rule families
test.mjs                   52 tests, run with npm run qa:test
samples/                   a deliberately flawed draft in .md and .docx
```

## Adding a rule

Add it to the right file in `src/rules/`:

```js
{
  id: 'category/short-name',
  title: 'What a reviewer would call this',
  category: 'Spacing',
  severity: 'minor',
  fixable: true,              // only if `fix` is always safe to apply blind
  check(doc, ctx) {
    return [...doc.scan(/pattern/g, { types: ['paragraph'] })].map(({ start, end }) => ({
      start, end, message: 'What is wrong.', suggestion: 'What to do.', fix: 'literal replacement',
    }));
  },
}
```

`doc.scan` skips code, URLs and paths for you. Return offsets; the engine turns
them into line and column, builds the excerpt, applies config overrides and
de-duplicates.

Then add two tests: one that it fires, and one that it stays quiet on correct
prose. The second is the one that matters.
