# QA checks reference

This list is now generated from the rules themselves, so it cannot drift out of
step with the tool:

```bash
npm run qa:manual      # writes report-qa-handbook.html
npm run qa:rules       # prints every rule to the terminal
```

**[report-qa-handbook.html](report-qa-handbook.html)** is the team handbook. It
covers what the tool is and is not, how it runs without a network, how to work
the findings, and every check grouped by family.

The hand-written table that used to live here was replaced because it had gone
stale: it reported the severity split as 20 blocker / 35 major / 38 minor /
12 nit, where the rules actually define 12 / 28 / 35 / 30. A reference that
disagrees with the tool is worse than no reference, so this one is built rather
than written.
