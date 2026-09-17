# LevelBlue Report QA - 105 Checks Reference

## Overview
This tool runs 105 automated quality assurance checks on cyber advisory reports and presentations before they go to clients. Organized by severity and category for easy reference.

---

## Severity Levels

| Level | Meaning |
|-------|---------|
| **Blocker** | Must not reach a client. Secrets, another client's name, placeholders, tracked changes, unresolved comments |
| **Major** | Wrong or reads as wrong. Missing sections, broken cross-references, CVSS mismatches, contradictory stats |
| **Minor** | Inconsistent. Spelling, formatting, capitalization, dash style, orphaned acronyms |
| **Nit** | Preference. Wordiness, trailing space, single-item lists, Oxford comma style |

---

## Confidentiality & Release Readiness (10 checks)

### Blockers
- **Credential or secret in the document** - AWS keys, passwords, API tokens, etc.
- **Another client's name appears in the draft** - Template leakage from a previous engagement
- **Internal-only content in a client deliverable** - "Day rate", "upsell", "not for distribution"
- **Unaccepted tracked changes** - Word change tracking still enabled
- **Unresolved reviewer comments** - Comments visible in the file

### Major
- **Engagement client is never named** - Template field wasn't filled in
- **Classification marking is missing or inconsistent** - "CONFIDENTIAL" appears/disappears
- **Reviewer highlighting left in the text** - Yellow/green highlighting survives to draft
- **Personal data in the report body** - Email addresses, phone numbers, payment cards, NI numbers

### Minor
- **Document metadata reveals the author or template origin** - File properties still name the previous client

---

## Slide-Specific (11 checks - PowerPoint only)

### Blockers
- **PowerPoint's own placeholder text is still on a slide** - "Click to edit Master title style"
- **Internal remarks in the speaker notes** - "Push them for more money", "guesstimate", "day rate"
- **Another client's name in the slide layouts** - Hidden in master slides or layouts
- **Unresolved comments in the deck** - Comment bubbles in slides

### Major
- **Slide has no content** - Title only, no body text
- **Speaker notes are present in a client deliverable** - Notes ship inside the file

### Minor
- **Slide has no title** - Slide exists but is untitled
- **Slide carries too much text** - Too dense, hard to read from distance
- **Two slides share a title** - Duplicate slide titles

### Nit
- **Too many bullets on one slide** - Exceeds recommended bullet count
- **Bullets nested too deeply** - Too many indentation levels

---

## Structure & Formatting (15 checks)

### Major
- **Section has no content** - Heading with no body text
- **Section is missing** - Required section not in the document
- **Cross-reference does not resolve** - "See Figure 4" but Figure 4 doesn't exist or is numbered differently
- **Repeated sentence or paragraph** - Copy-paste artifact
- **Table rows have different column counts** - Ragged table

### Minor
- **Heading level skipped** - Jumps from H1 to H3, skipping H2
- **Duplicate heading text** - Two sections with identical titles
- **Inconsistent heading capitalisation** - Title Case vs Sentence case mixed
- **Figure or table numbering is not sequential** - Figures jump from 2 to 4
- **Mixed bullet markers** - Some bullets use •, others use -
- **Bare or insecure URL** - URL not in hyperlink, or uses HTTP not HTTPS
- **Non-standard product, vendor or standard name** - "Azure AD" instead of "Microsoft Entra ID", "NIST Cybersecurity Framework" instead of "NIST CSF 2.0"

### Nit
- **List with only one item** - Single-item lists don't need bullets
- **Recommend confirming latest LevelBlue logo** - Check logo is current (LevelBlue house style)
- **Recommend including a revision number** - No version number found

### Blocker
- **Unfinished placeholder text** - "[CLIENT NAME]", "TBC", "[FINDINGS]"

---

## Cyber Security Accuracy (10 checks)

### Blockers
- **CVSS score problem** - Score outside range (0-10), band label doesn't match score, inconsistent versions

### Major
- **Malformed CVE identifier** - CVE-2026-1 (should be CVE-2026-00001)
- **Invalid NIST CSF 2.0 identifier** - PR.XX-01 (should be GV.XX-01, ID.XX-01, etc.)
- **Severity label is not on the report scale** - Says "Critical" but scale only has "High"
- **Live indicator of compromise is not defanged** - Real IP address, domain, email left in sample
- **Risk statement with no business consequence** - Describes technical risk without impact

### Minor
- **Malformed MITRE ATT&CK technique ID** - T1234x (should be T1234 or T1234.001)
- **ISO/IEC 27001 control reference looks out of date** - References 2013 version (now 2022)
- **Recommendation is not actionable** - Vague advice with no owner or timeframe

---

## Numbers & Statistics (8 checks)

### Blockers
- **The same statistic is given two different values** - "14 findings" on page 1, "12 findings" on page 5

### Major
- **Percentages do not add up** - Breakdown totals 95% or 110% instead of 100%
- **Past-tense statement with a future date** - "Was configured" but date is 2027

### Nit
- **Inconsistent spacing between number and unit** - "5 MB" vs "10MB"
- **Inconsistent numeral style** - Some numbers written as "5", others as "five"
- **Number written twice** - Same value mentioned in different ways
- **Inconsistent currency formatting** - "£5,000" vs "$5000"
- **Large number without a thousands separator** - "1000000" instead of "1,000,000"

---

## Spelling & Dialect (5 checks)

### Major
- **Spelling does not match the report dialect** - "Color" in a British English report

### Minor
- **Date format does not match the report dialect** - "03/04/2026" (ambiguous) in formal document

### Nit
- **Abbreviation punctuation does not match the dialect** - "Dr" vs "Dr."
- **Collective-noun agreement differs between dialects** - "The team are" (UK) vs "The team is" (US)
- **Inconsistent treatment of "data"** - "Data are" on page 1, "Data is" on page 5

---

## Terminology (7 checks)

### Major
- **Acronym used without expansion** - "MFA" used without defining "multi-factor authentication"
- **Acronym expansion does not match the usual meaning** - "MFA" defined as something other than standard

### Minor
- **Non-standard product, vendor or standard name** - See Structure section above
- **The same term is capitalised differently** - "Risk Assessment" vs "risk assessment"
- **First-person voice against house style** - Using "I" or "we" when reports should use passive

### Nit
- **Acronym expanded more than once** - MFA defined on page 2, defined again on page 10
- **Acronym defined but never used again** - "Multi-factor authentication (MFA)" mentioned once then dropped

---

## Punctuation & Typography (15 checks)

### Major
- **Unbalanced brackets or quotation marks** - Opening bracket without closing
- **Repeated or stacked punctuation** - "What?!" or "...", ".."
- **Word repeated** - "The the"
- **Sentence starts with a lower-case letter** - "this is wrong"
- **Missing space after punctuation** - "words.Like" instead of "words. Like"

### Minor
- **Mixed straight and curly quotation marks** - "Hello" vs "Hello"
- **Hyphen used where a dash belongs** - "high-risk" vs "high–risk"
- **Mixed dash conventions** - En-dash, em-dash, and hyphen all used
- **Inconsistent serial (Oxford) comma** - "A, B, and C" vs "A, B and C"
- **Inconsistent punctuation at the end of bullets** - Some bullets end with periods, others don't
- **Possible comma splice** - Two independent clauses joined with a comma

### Nit
- **Three full stops instead of an ellipsis** - "..." vs "…"
- **Heading ends with a full stop** - "Introduction." (headings shouldn't end with periods)
- **Punctuation placement around closing quotes** - "quote." vs "quote".

---

## Whitespace & Formatting (11 checks)

### Major
- **Missing space after punctuation** - See Punctuation section above
- **Empty list item or table cell** - Blank bullet point or table cell

### Minor
- **Multiple consecutive spaces** - Double spaces between words
- **Mixed one-space and two-space sentence separation** - Inconsistent spacing after periods
- **Excessive vertical white space** - Multiple blank lines in a row
- **Invisible or non-standard space characters** - Smart spaces from Word, non-breaking spaces
- **Space before punctuation** - "word ." instead of "word."

### Nit
- **Trailing whitespace at end of line** - Invisible spaces at line end
- **Tab character inside prose** - Tab instead of spaces
- **Space just inside brackets** - "[ text ]" instead of "[text]"
- **Heading not separated from surrounding text** - No blank line between heading and body

---

## Readability & Language (17 checks)

### Major
- **Unsupportable absolute claim** - "Never fails", "Always works" without evidence

### Minor
- **Sentence is too long** - Exceeds recommended length
- **Paragraph is too long** - Too many sentences, hard to follow
- **Section is harder to read than the house target** - Flesch readability score too high

### Nit
- **Passive voice** - "Was configured" instead of "The team configured"
- **Hedged language** - "Might", "could", "may suggest"
- **Wordy phrase with a shorter equivalent** - "In order to" instead of "to"
- **Vague quantifier where a number belongs** - "Many findings" instead of "14 findings"
- **Intensifier that adds no information** - "Very important", "quite critical"
- **Commonly confused word** - "Their" vs "there", "it's" vs "its"
- **Consecutive sentences open with the same word** - Both start with "The..."
- **Recommendation does not start with a verb** - "It's important to" instead of "Implement..."
- **Findings mix past and present tense** - "Was found" then "is a risk"
- **"etc." in a technical list** - Use "such as" or spell out items

---

## Summary

| Severity | Count |
|----------|-------|
| Blocker | 20 |
| Major | 35 |
| Minor | 38 |
| Nit | 12 |
| **Total** | **105** |

---

## Quick Reference by Use Case

**Template Leakage?**
Check: confidentiality/wrong-client, slides/template-leakage, confidentiality/document-metadata

**CVSS Mistakes?**
Check: cyber/cvss-score, cyber/cve-format

**Spelling/Grammar?**
Check: dialect/mixed-spelling, punctuation/*, whitespace/*, language/*

**Credentials Exposed?**
Check: confidentiality/secret (highest priority blocker)

**PowerPoint Issues?**
Check: slides/* (11 checks specific to .pptx files)

**Cross-References Broken?**
Check: structure/cross-reference, structure/caption-sequence, structure/heading-level-skip

**Statistics Mismatched?**
Check: numbers/contradictory-statistic, numbers/percentage-total, cyber/severity-scale
