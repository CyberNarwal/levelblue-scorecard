---
name: report-qa
description: QA a cyber advisory report draft or slide deck before it goes to a client - grammar, punctuation, UK/US spelling consistency, spacing and white space, terminology, CVSS/CVE/NIST CSF accuracy, structure, and the confidentiality checks that stop credentials, another client's name, tracked changes, unresolved comments or speaker notes reaching a deliverable. Use whenever someone asks to proofread, QA, review, check or sanity-check a report, assessment, advisory, findings document, board pack or deliverable draft (.pptx, .docx, .md, .html).
---

# Cyber advisory report QA

You are doing the final quality pass on a consulting deliverable. The author is
about to send this to a paying client. Your job is to catch everything that
would embarrass them, in priority order: content that must not ship, statements
that are wrong, then everything that reads as careless.

There are two layers, and you need both:

- **The linter** (`tools/report-qa/cli.mjs`) does the mechanical work: spacing,
  punctuation, dialect consistency, identifier formats, secrets, structure. It
  is exhaustive and it does not get bored. Never do this part by eye.
- **You** do the part rules cannot: does the executive summary match the
  findings, is the severity justified, is the remediation advice technically
  correct, will the intended reader understand it.

Report both together, as one QA pass.

## Step 1 - Establish the target and the standard

Find the draft. If the user did not name a file, ask rather than guess.

Read `report-qa.config.json` (repo root) to learn the house style: dialect,
severity scale, required sections, forbidden client names. If the engagement
client is not set in the config, ask the user for:

- the client's name (so the tool can confirm the draft names them), and
- any previous client whose template this draft came from (the single most
  common confidentiality failure in consulting is another client's name
  surviving a copy-paste).

Then pass them for this run rather than editing the shared config, unless the
user asks you to make the change permanent.

## Step 2 - Run the linter

```bash
node tools/report-qa/cli.mjs <draft> --format json
```

(The same engine is also shipped as `report-qa.html`, a self-contained offline
page the author can use without you. If someone asks how to run the checks
themselves, point them at that file and `npm run qa:build` to rebuild it after
a rule change.)

Useful variations:

- `--dialect en-GB` when the draft is too short for reliable auto-detection.
- `--now 2026-03-12` so date checks run against the report date, not today.
- `--severity major` to triage a very noisy first draft.
- `--only confidentiality,structure/placeholder-text` for a fast pre-send check.

`.docx` is read directly, including tracked changes, comments, highlighting,
headers and footers. `.pptx` is read too - slides, tables, speaker notes,
comments, and the text in slide layouts and masters - and findings in a deck are
reported by slide number. **PDF is refused on purpose** - text extraction is too
unreliable to QA against. Ask for the source document.

When the draft is a deck, weight your own reading differently: the argument
lives in the slide titles read in sequence, and the speaker notes are the part
the author forgot ships with the file. Read the notes.

If the tool reports `ruleErrors`, say so; those checks did not run.

## Step 3 - Verify before you repeat

Do not forward the linter's output unread. For every finding above `nit`, open
the cited line and confirm it in context. The rules that most often need human
judgement:

| Rule | Check before repeating it |
|---|---|
| `dialect/mixed-spelling` | Quoted material and proper nouns keep their original spelling. |
| `terminology/canonical-name` | A deliberate historical reference ("the then Azure AD") is correct. |
| `structure/cross-reference` | The target may exist but be numbered differently. |
| `cyber/risk-without-impact` | The consequence may be in the next sentence. |
| `language/*` | Density rules are advisory. One long sentence is not a finding. |
| `numbers/percentage-total` | Rounding, or a breakdown that genuinely is not exhaustive. |

State findings you checked and rejected as rejected. A QA pass that repeats
false positives gets ignored, and then the real findings go with it.

## Step 4 - The judgement pass

Read the draft yourself and work through
`reference/review-checklist.md`. In short, the six that matter most:

1. **Summary/body agreement** - does every claim in the executive summary hold
   up against the findings section? Counts, severities, themes, the maturity
   rating.
2. **Evidence** - is each finding supported by something observed, or is it
   assertion? Flag findings with no stated basis.
3. **Severity justification** - does the rating follow from the stated impact
   and likelihood, and is it consistent across findings of similar kind?
4. **Remediation quality** - is the advice technically correct, proportionate,
   and actually implementable by this client? Wrong remediation advice is worse
   than none.
5. **Audience** - an executive summary a board can read, detail a technical
   team can act on, and no unexplained jargon in the wrong section.
6. **Logical completeness** - every finding has a recommendation, every
   recommendation traces to a finding, nothing dangles.

## Step 5 - Report

Lead with the answer to the only question the author has: *can I send this?*

```markdown
## QA: <report name>

**Verdict:** Not ready to issue - 3 blockers / Ready after minor edits / Ready

### Must fix before issue
1. **Line 36** - AWS access key left in finding F-01. Remove and rotate it.
2. **Line 24** - CVSS 9.8 is Critical, table says High. One of the two is wrong.

### Should fix
...

### Judgement calls for you
- The executive summary says "14 critical findings"; the table lists 12. I
  cannot tell which is right.

### Checked and dismissed
- `terminology/canonical-name` on "Azure AD" at line 14 - correct as a
  historical reference.

<mechanical summary: N blockers, N major, N minor, N nits; N auto-fixable>
```

Rules for the write-up:

- Every item carries a line number and says what to change, not just what is wrong.
- Never print a secret the linter found. Say what it is and where.
- Group the nits; do not list forty of them individually.
- If the draft is clean, say so plainly and stop. Do not invent findings.

## Editing

Report by default; do not rewrite the author's draft uninvited.

When the user does ask you to fix things:

```bash
node tools/report-qa/cli.mjs <draft> --fix
```

`--fix` only applies unambiguous, high-confidence corrections (double spaces,
trailing whitespace, stacked punctuation, repeated words, malformed identifiers,
minority-dialect spellings). It never touches wording, severity or structure.
It cannot rewrite `.docx` - for Word drafts, report the findings and let the
author apply them, or ask whether they want the text exported first.

Anything needing judgement, make as a normal edit and show the diff.

## Adding a check

New house-style rule: `tools/report-qa/src/rules/<category>.mjs`, then a test in
`tools/report-qa/test.mjs`. Every rule needs a test that it fires **and** a test
that it stays quiet on correct prose - the second one matters more. Run
`node --test tools/report-qa/test.mjs`.

One-off exceptions belong in the draft, not the rule set:

```markdown
<!-- qa-disable terminology/canonical-name -->
```
