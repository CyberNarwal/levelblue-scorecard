# report-qa

Mechanical QA for cyber advisory report drafts. Zero dependencies, pure Node.

This is the deterministic half of the report QA agent. It catches everything a
rule can catch, so the reviewing agent (`.claude/skills/report-qa/`) can spend
its attention on the things a rule cannot: whether the argument holds, whether
the severity is justified, whether the remediation advice is actually correct.

## The offline page

`report-qa.html` in the project root is the whole tool as one self-contained
file. See [DISTRIBUTION.md](DISTRIBUTION.md) for getting it to a team.
Open it in a browser, drag a draft onto it, read the findings. No install,
no terminal, no server, and no network: the file can be copied to a machine with
the Wi-Fi off and it still works. Client drafts never leave the computer.

Rebuild it after changing any rule:

```bash
npm run qa:build                          # writes report-qa.html
```

The build fails rather than emitting a page that contains a `fetch`, an external
script or stylesheet, or a WebSocket - the offline guarantee is enforced, not
just intended.

## The command line

```bash
npm run qa -- path/to/draft.docx          # check a draft
npm run qa -- draft.md --fix              # apply the unambiguous corrections
npm run qa:rules                          # list every rule
npm run qa:test                           # run the test suite
```

## What it reads

| Format | Support |
|---|---|
| `.pptx` | Full, read-only. Slides, titles, bullets, tables, **speaker notes**, comments, and the text in slide layouts and masters. Findings are reported by slide number |
| `.docx` | Full, read-only. Also reads tracked changes, comments, highlighting, headers, footers and document properties |
| `.md`, `.txt` | Full, including `--fix` |
| `.html` | Converted to text, read-only |
| `.pdf` | **Refused on purpose.** Text extraction from PDF is unreliable enough that QA on the result is worse than no QA. Check the source document |
| `.doc`, `.ppt` | Refused. Save as the modern format first |

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

103 rules in ten families. `npm run qa:rules` prints the current list.

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
- **Slides** (.pptx only) - slides with no title, too much text on one slide,
  too many or too deeply nested bullets, empty slides, duplicate titles,
  PowerPoint's own prompt text left in a placeholder ("Click to edit Master
  title style"), speaker notes present in a client deliverable, internal
  remarks inside those notes, another client's name surviving in the slide
  layouts or masters, and unresolved comments.
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

**Everything is offsets.** Extractors for Markdown, DOCX, PPTX and HTML all
produce the same `Document` - one normalised string plus blocks with absolute
offsets - so no rule needs to know what the draft was authored in, and `--fix`
can apply edits back-to-front without invalidating positions. A block may carry
a `slide` number, which is what lets a deck's findings be reported as
"Slide 4" instead of a line number that would mean nothing to the author.

**The engine is environment-agnostic.** Nothing under `src/` touches a Node API
except `config-node.mjs` and `load.mjs`, which exist only to read from disk.
DEFLATE is implemented in `extract/inflate.mjs` rather than imported from
`node:zlib`, and the ZIP reader works on plain `Uint8Array`, so the same DOCX
parser runs in Node and in the browser. That is what makes the offline page
possible without a second implementation to keep in sync.

**Secrets are masked document-wide, not per finding.** Excerpts are cut only
after every rule has run, from a copy of the text with all sensitive spans
replaced. Masking each finding's own match is not enough: a credential one line
away still lands inside a neighbouring finding's context window.

## Layout

```
cli.mjs                    argument parsing, output, exit codes
build-standalone.mjs       bundles the engine into one offline HTML file
browser/                   the offline page: UI, template, browser file loading
src/engine.mjs             runs rules, suppresses, de-duplicates, sorts
src/document.mjs           the Document model and the Markdown parser
src/config.mjs             defaults, merge, validation (no Node APIs)
src/config-node.mjs        reading report-qa.config.json from disk
src/load.mjs               format detection and dispatch
src/fix.mjs                back-to-front application of safe corrections
src/report.mjs             text, Markdown and JSON output
src/text.mjs               offsets, sentence splitting, readability
src/extract/ooxml.mjs      shared ZIP, entity and relationship handling
src/extract/docx.mjs       WordprocessingML reader
src/extract/pptx.mjs       PresentationML reader, including speaker notes
src/extract/inflate.mjs    DEFLATE decompression, so Office files work in a browser
src/data/                  dialect pairs, security terms, writing-quality lists
src/rules/                 the nine rule families
test.mjs                   64 tests, run with npm run qa:test
samples/                   deliberately flawed samples: .md, .docx and .pptx
DISTRIBUTION.md            getting the offline page to a team
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
