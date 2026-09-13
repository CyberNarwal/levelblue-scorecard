# LevelBlue Scorecard

A NIST CSF 2.0 / CIS Controls assessment scorecard, plus a QA tool for the
advisory reports that come out of it.

## Report QA

**Open `report-qa.html` in a browser and drag a report draft onto it.**

It checks spelling and grammar (British or American, consistently), spacing and
white space, punctuation, terminology, CVSS/CVE/NIST CSF accuracy, document
structure, and the things that must never reach a client - credentials, another
client's name, tracked changes, unresolved comments, placeholder text.

It runs entirely on your own computer. Nothing is uploaded and it works offline.

Full documentation, configuration and the command-line version:
[`tools/report-qa/README.md`](tools/report-qa/README.md).

---

## The scorecard app

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
