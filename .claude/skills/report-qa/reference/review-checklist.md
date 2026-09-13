# The judgement pass

Everything here needs a reader who understands the engagement. None of it can
be a regex, which is why the linter does not attempt it. Work through the
sections in order; stop early only if the draft fails Section 1, because
nothing below matters until that is fixed.

---

## 1. Release blockers

Things that make the draft unsendable regardless of quality.

- [ ] Any credential, key, token, hash or password in the text. Report the
      location, never the value, and tell the author to rotate it.
- [ ] A different client's name, logo reference, or engagement detail surviving
      from the template. Check document properties as well as the body.
- [ ] Tracked changes or comments still live in a `.docx`.
- [ ] Internal-only content: margins, day rates, delivery notes, "don't tell
      them about X", upsell framing.
- [ ] Placeholder text, unfilled template fields, TBC/TBD.
- [ ] Live indicators of compromise presented as clickable links.
- [ ] Personal data about named individuals that the deliverable does not need.
- [ ] Classification marking absent, or two different markings present.

## 2. Internal consistency

The failure mode is a draft edited in three sittings by two people.

- [ ] Every number in the executive summary matches the findings section:
      counts by severity, total findings, percentages, maturity scores.
- [ ] The maturity rating or overall verdict in the summary matches what the
      detail actually supports.
- [ ] Severity labels are used consistently, and only values on the scale.
- [ ] A finding's severity is the same everywhere it appears (summary, table,
      detail section, appendix, remediation plan).
- [ ] Scope statements agree: what the summary says was assessed matches what
      the methodology says, and what the findings actually cover.
- [ ] Dates agree: assessment window, report date, remediation deadlines.
      Nothing in the past tense has a future date.
- [ ] Cross-references resolve, and the tables and figures they point at exist.

## 3. Evidence and argument

- [ ] Each finding states what was observed, not just what is wrong. "MFA is
      not enforced" needs "we reviewed the conditional access policies on
      4 March and found no policy requiring MFA for administrative roles".
- [ ] Nothing is asserted that the assessment could not have established. If
      the estate was sampled, the finding says so.
- [ ] Risk statements name cause, event and consequence. A risk with no stated
      business consequence is an observation, not a risk.
- [ ] Severity ratings follow from stated impact and likelihood, and comparable
      findings are rated comparably. An unexplained Critical next to an
      identical High is the first thing a client will challenge.
- [ ] Where a CVSS score is quoted, the vector or at least the version is given,
      and the score matches the severity word next to it.
- [ ] Positive findings are included. A report with no strengths reads as a
      sales document.
- [ ] Nothing over-claims: no guarantees, no "eliminates the risk", no
      "100% secure". These create liability.

## 4. Remediation quality

This is where a report earns or loses its fee.

- [ ] Every finding has at least one recommendation, and every recommendation
      traces back to a finding.
- [ ] The advice is technically correct. Check it against how the control
      actually works, not how it is usually described.
- [ ] It is proportionate to the finding and to this client's size, sector and
      maturity. Do not recommend a SOAR platform to a 40-person firm with no
      SIEM.
- [ ] Each action names an owner (or an owning function) and a timeframe.
- [ ] Dependencies and sequencing are stated where one action blocks another.
- [ ] Effort or cost indication is present where the client must prioritise.
- [ ] Quick wins are separated from strategic work.
- [ ] Nothing recommends a product by name without saying why, or in a way that
      reads as a sales pitch.

## 5. Framework and regulatory accuracy

- [ ] Control identifiers exist and are current: NIST CSF 2.0 subcategories,
      ISO/IEC 27001:2022 Annex A (two-level, not the withdrawn 2013 numbering),
      CIS Controls v8, PCI DSS v4.
- [ ] Mappings are defensible - a finding mapped to a subcategory it does not
      really touch will be challenged.
- [ ] Regulatory claims are accurate and current: UK GDPR and ICO breach
      notification, NIS2 scope and deadlines, DORA applicability, sector rules.
- [ ] Any legal or regulatory statement is framed as an observation, not legal
      advice, unless the engagement covers that.
- [ ] Standards are cited by their formal names and current versions.

## 6. Audience and readability

- [ ] The executive summary works for a reader who will read nothing else, and
      contains no unexplained jargon.
- [ ] The technical sections contain enough detail to act on without going back
      to the assessor.
- [ ] Acronyms are expanded on first use and then used consistently.
- [ ] The tone is advisory, not alarmist and not reassuring. No scare framing to
      motivate spend.
- [ ] The reader always knows whose action is being described - the client's,
      the assessor's, or an attacker's.
- [ ] Tables and figures are readable standing alone, with captions that say
      what the reader should take from them.

## 7. Structure and completeness

- [ ] The sections the engagement contracted for are all present.
- [ ] Heading hierarchy is sound and the contents page matches the headings.
- [ ] Findings are ordered by severity or by a stated logic, not by the order
      they were discovered.
- [ ] Appendices are referenced from the body and are actually needed.
- [ ] Version, date, author and distribution list are present and correct.
- [ ] Limitations and assumptions are stated: what was out of scope, what could
      not be tested, what the client asserted rather than evidenced.

---

## Reporting the judgement pass

Separate what you are confident about from what the author must decide.

- **Confident** - a factual error, an internal contradiction, wrong remediation
  advice, a mis-mapped control. State it and give the correction.
- **Judgement** - a severity you would have rated differently, an argument you
  find thin, tone. Raise it as a question with your reasoning, and let the
  author decide. They know the client and you do not.

Never manufacture findings to look thorough. "Section 4 is sound" is a
legitimate and useful result.
