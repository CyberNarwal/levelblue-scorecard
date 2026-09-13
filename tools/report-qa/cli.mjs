#!/usr/bin/env node
/**
 * report-qa - mechanical QA for cyber advisory report drafts.
 *
 * Usage:
 *   node tools/report-qa/cli.mjs <draft> [options]
 *
 * Options:
 *   --format text|md|json   Output shape (default: text, or md when piped)
 *   --dialect en-GB|en-US   Force a dialect instead of inferring one
 *   --config <path>         Explicit config file
 *   --fix                   Apply the unambiguous corrections in place
 *   --fix-to <path>         Write the corrected text to a new file instead
 *   --only <rule,prefix>    Run only these rules or rule prefixes
 *   --skip <rule,prefix>    Skip these rules or rule prefixes
 *   --severity <level>      Report only this severity and above
 *   --fail-on <level>       Exit non-zero at this severity (default: major)
 *   --now <YYYY-MM-DD>      Treat this as the report date for date checks
 *   --list-rules            Print every rule and exit
 *   --quiet                 Findings only, no summary header
 */

import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

import { loadConfig, severityRank, SEVERITIES } from './src/config.mjs';
import { ALL_RULES, analyse } from './src/engine.mjs';
import { applyFixes } from './src/fix.mjs';
import { loadDocument } from './src/load.mjs';
import { formatJson, formatMarkdown, formatText } from './src/report.mjs';

function parseArgs(argv) {
  const options = { paths: [], format: null, fix: false, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value.`);
      i += 1;
      return value;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--list-rules') options.listRules = true;
    else if (arg === '--fix') options.fix = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--no-colour' || arg === '--no-color') options.colour = false;
    else if (arg === '--fix-to') options.fixTo = next();
    else if (arg === '--format') options.format = next();
    else if (arg === '--dialect') options.dialect = next();
    else if (arg === '--config') options.config = next();
    else if (arg === '--only') options.only = next().split(',').map((s) => s.trim());
    else if (arg === '--skip') options.skip = next().split(',').map((s) => s.trim());
    else if (arg === '--severity') options.severity = next();
    else if (arg === '--fail-on') options.failOn = next();
    else if (arg === '--now') options.now = next();
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}. Try --help.`);
    else options.paths.push(arg);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  if (options.help) {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (options.listRules) {
    const width = Math.max(...ALL_RULES.map((r) => r.id.length));
    for (const rule of ALL_RULES) {
      process.stdout.write(`${rule.severity.padEnd(8)} ${rule.id.padEnd(width)}  ${rule.title}\n`);
    }
    process.stdout.write(`\n${ALL_RULES.length} rules.\n`);
    return 0;
  }

  if (!options.paths.length) {
    process.stderr.write('Give me a draft to check.\n\n' + helpText() + '\n');
    return 2;
  }

  const overrides = {};
  if (options.dialect) overrides.dialect = options.dialect;
  if (options.failOn) overrides.failOn = options.failOn;
  if (options.only || options.skip) {
    overrides.rules = {};
    for (const rule of ALL_RULES) {
      const matches = (list) => list.some((entry) => rule.id === entry || rule.id.startsWith(`${entry}/`) || rule.id.split('/')[0] === entry);
      if (options.only && !matches(options.only)) overrides.rules[rule.id] = 'off';
      if (options.skip && matches(options.skip)) overrides.rules[rule.id] = 'off';
    }
  }

  let config;
  let configPath;
  try {
    ({ config, configPath } = loadConfig({ configPath: options.config, overrides }));
  } catch (error) {
    process.stderr.write(`Configuration error: ${error.message}\n`);
    return 2;
  }

  const now = options.now ? new Date(`${options.now}T12:00:00Z`) : new Date();
  if (Number.isNaN(now.getTime())) {
    process.stderr.write(`--now must be YYYY-MM-DD (got "${options.now}").\n`);
    return 2;
  }

  let worstRank = SEVERITIES.length;
  const isTty = process.stdout.isTTY;
  const format = options.format || (isTty ? 'text' : 'md');

  for (const path of options.paths) {
    let doc;
    try {
      doc = loadDocument(path);
    } catch (error) {
      process.stderr.write(`${path}: ${error.message}\n`);
      worstRank = -1;
      continue;
    }

    const result = analyse(doc, { config, now });

    if (options.severity) {
      const floor = severityRank(options.severity);
      result.findings = result.findings.filter((f) => severityRank(f.severity) <= floor);
    }

    if (options.fix || options.fixTo) {
      if (doc.format === 'docx') {
        process.stderr.write(`${path}: --fix cannot rewrite a .docx safely. Findings are reported; apply them in Word.\n`);
      } else {
        const { text, applied, skipped } = applyFixes(doc, result.findings);
        const target = options.fixTo || path;
        if (applied.length) writeFileSync(target, text, 'utf8');
        process.stderr.write(`${relative(process.cwd(), target) || target}: applied ${applied.length} fix${applied.length === 1 ? '' : 'es'}`
          + `${skipped.length ? `, skipped ${skipped.length} overlapping` : ''}.\n`);
        // Re-run so the reported findings reflect the corrected file.
        if (applied.length) {
          const fixedDoc = loadDocument(target);
          const rerun = analyse(fixedDoc, { config, now });
          result.findings = rerun.findings;
          result.stats = rerun.stats;
          result.errors = rerun.errors;
        }
      }
    }

    const meta = { source: path, format: doc.format, now, configPath };
    const output = format === 'json' ? formatJson(result, meta)
      : format === 'md' ? formatMarkdown(result, meta)
        : formatText(result, meta, { colour: options.colour !== false && isTty, quiet: options.quiet });
    process.stdout.write(`${output}\n`);

    for (const finding of result.findings) {
      worstRank = Math.min(worstRank, severityRank(finding.severity));
    }
  }

  if (worstRank === -1) return 2;
  if (config.failOn === 'never') return 0;
  return worstRank <= severityRank(config.failOn) ? 1 : 0;
}

function helpText() {
  return `report-qa - mechanical QA for cyber advisory report drafts

  node tools/report-qa/cli.mjs <draft.md|draft.docx|draft.html> [options]

  --format text|md|json   output shape (default: text on a terminal, md when piped)
  --dialect en-GB|en-US   force a dialect instead of inferring one from the draft
  --config <path>         explicit config file (default: nearest report-qa.config.json)
  --fix                   apply the unambiguous corrections in place (text formats only)
  --fix-to <path>         write corrected text to another file instead of in place
  --only <a,b>            run only these rules or rule prefixes
  --skip <a,b>            skip these rules or rule prefixes
  --severity <level>      show only this severity and above (blocker|major|minor|nit)
  --fail-on <level>       exit 1 at this severity or worse (default: major, "never" disables)
  --now <YYYY-MM-DD>      treat this as the report date when checking dates
  --list-rules            print every rule and exit
  --quiet                 findings only

Exit codes: 0 clean, 1 findings at or above --fail-on, 2 could not run.`;
}

process.exitCode = main(process.argv.slice(2));
