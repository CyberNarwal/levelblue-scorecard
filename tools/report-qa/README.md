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

## The handbook

`report-qa-handbook.html` is the team-facing manual - what the tool is and is
not, how it runs without a network, how to work the findings, and every check
grouped by family. It is generated, so the check list cannot drift out of step
with the rules:

```bash
npm run qa:manual                         # writes report-qa-handbook.html
```

Distribute it beside `report-qa.html`: it is a single self-contained file too,
and opens offline the same way. It is held to the tool's own standard - the
build refuses to emit a handbook carrying a webfont link, an external script or
a network call, because a document whose subject is a tool that touches no
network cannot itself phone out when someone opens it.

## What the levels mean

Every finding carries one of four levels, and the page explains them behind
"What do these mean?" next to the filter:

| Level | Means |
|---|---|
| Blocker | Must not reach a client at all: a credential, another client's name, an unresolved comment, a tracked change. Fix before the draft leaves the building. |
| Major | Wrong, or reads as wrong to the client: a missing section, a cross-reference that goes nowhere, a CVSS score that contradicts its own label. |
| Minor | The draft disagrees with itself on spelling, capitalisation, dashes or spacing. Each one is small; together they are what makes a report look unchecked. |
| Nit | A preference rather than a fault - wordiness, hedging, passive voice. Fix if you have the time. |

Separately, each check belongs to a family - Confidentiality, Release readiness,
Structure, Terminology, Dialect, Slides, Security accuracy and so on - named
under the group it raised.

## Engagement settings

Four values describing the engagement rather than the file, remembered in the
browser and applied to every draft until changed. The page opens them on a first
visit and states on the button what they are currently doing, because three
checks cannot run without them and an empty field silently narrows the QA pass:

| Setting | Without it |
|---|---|
| English | The dialect is inferred from the draft, which is unreliable on a short deck |
| This client's name | Nothing notices that the report never names the client - the sign of a template field nobody filled in |
| Other clients' names | Nothing notices a previous client's name surviving in a copied deck, including in the slide masters where reading the slides will not show it |
| Required marking | The classification marking is not checked |

## Reading the findings

Every finding quotes the draft's own words with the flagged run highlighted, so
a reviewer can match it against the slide in front of them without hunting for
the rule's meaning. Whitespace faults are highlighted too, which is the only way
a double space or a stray tab is visible at all.

The list is built to be read top-down in one screen rather than scrolled:

- Findings are gathered under the rule that raised them. A rule that fired eight
  times is one row with a count and a preview of the flagged words, not eight
  rows repeating the same explanation. Open it for the eight places.
- Blockers and majors start open, because they decide whether the draft can go
  out. Minors and nits start shut.
- **Show** filters the list to one severity. `Blocker` alone is the go/no-go
  view; clicking it again clears the filter.
- Printing opens everything first, so a collapsed group cannot silently vanish
  from a PDF.

## Ignoring what does not apply

No rule set is right about everything, so the reviewer has the last word.
**Ignore** on a finding stops that flagged text being reported by that check;
**Ignore check** sets the whole check aside for this draft. Both are judgements
about this report, not edits to it.

Dismissed findings are never simply gone. They collect in an **Ignored** section
at the foot of the list with the count and a **Restore** for each, the running
total sits on the line under the verdict, and the copied formats state how many
were left out - a QA pass whose exclusions are invisible is one nobody can check.
Every count, the verdict and all four exports move together, so what you copy is
what you see.

The decisions live in the page for as long as it is open, and survive
re-checking the same draft after a round of edits because they are keyed to the
flagged words rather than to a line number. They are deliberately not written to
storage: the keys would carry text out of a client deliverable, and the promise
this tool makes is that the draft stays on the machine. For an exclusion that
should outlive the tab, put `<!-- qa-disable rule/id -->` in the draft (see
below) or turn the rule off in `report-qa.config.json`.

## Handing findings back

**Copy** puts the findings on the clipboard in the shape the next person needs:

| Button | For |
|---|---|
| For comments | One block per finding, to paste into the comment on that slide or paragraph |
| Summary | One line per finding, blockers first, to attach to the mail back to the author |
| Blocker list | Only what stops the draft being issued |
| Full report | The full markdown report, for a review thread |

All four quote the flagged text, because "line 42 has an American spelling" sends
the author looking and `Found: "color"` does not.

## Writing comments into the deck

For a `.pptx`, **Download deck with comments** saves a copy carrying one real
PowerPoint comment per finding, on the slide it came from. The consultant opens
it, works through the comment pane and resolves each one - no transcribing from
a QA report into a deck by hand.

This works because PresentationML anchors a comment to a slide and a position
rather than to a run of text, and the checker already knows the slide. Word is
the harder case: its comments have to be spliced into the exact runs inside
`document.xml`, and the extractor does not currently keep the positions that
would need.

What it does to the file:

- **It writes a copy.** `Deck (QA comments).pptx`. The file you dropped in is
  read and never written to. This is the only part of the tool that produces a
  file at all, and it does not touch the original.
- **The slides are copied across byte for byte**, still compressed, so nothing
  is re-encoded behind the author's back. A test asserts this.
- **Comments already in the deck are kept**, and so is their author. Running it
  twice adds the second pass rather than replacing the first.
- **Ignored findings are left out**, the same as the copied formats.

A malformed package makes PowerPoint offer to "repair" a client deliverable, so
the tests check more than the comments: every relationship target resolves,
every part is declared in `[Content_Types].xml`, and the deck still reads back
with its slides intact.

## Where the framework data comes from

The canonical names, current versions and control-identifier shapes are taken
from each framework's own publisher - NIST, ISO, PCI SSC, CIS, NCSC, EUR-Lex -
and each rule's note says which one, so a disputed finding can be checked
against the source.

They are deliberately **not** taken from the Secure Controls Framework or any
other third-party compilation. The SCF is the best single map of the landscape
and is worth reading to decide which frameworks to cover, but it is published
under CC BY-ND 4.0: the SCF Council states the licence forbids distributing
derivative content, and says so explicitly for content produced from it by AI.
Reshaping their catalogue into rule data and shipping it inside `report-qa.html`
would need a commercial Licensed Content Provider agreement. Taking the scope
from it and the facts from the publishers avoids that, and sidesteps the UK/EU
database right that can attach to a compilation even where the entries
themselves are free.

If a version in `RETIRED_VERSIONS` goes stale, correct it against the
publisher rather than a secondary source, and update the note with it.

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

## Exit codes

Levels are described under [What the levels mean](#what-the-levels-mean).
`--fail-on` (default `major`) sets the exit code, so this drops into a
pre-commit hook or CI unchanged. Exit 0 clean, 1 findings at or above the
threshold, 2 could not run.

## What it checks

105 rules in eighteen families. `npm run qa:rules` prints the current list.

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
