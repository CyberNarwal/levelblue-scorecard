#!/usr/bin/env node
/**
 * Build the standalone offline QA page.
 *
 * Produces a single self-contained HTML file with the whole rule engine inlined.
 * No server, no network, no dependencies at runtime - you double-click it and it
 * opens in a browser. That is the point: report drafts are confidential, so the
 * tool has to work with the machine offline.
 *
 *   node tools/report-qa/build-standalone.mjs [--out <path>]
 *
 * esbuild comes in with Vite, so this adds no new dependency. If it is ever
 * missing, the build says so rather than producing a broken page.
 */

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const require = createRequire(import.meta.url);

function loadEsbuild() {
  try {
    return require('esbuild');
  } catch {
    throw new Error(
      'esbuild is not installed. Run "npm install" in the project root first '
      + '(esbuild ships with Vite, so this needs no extra package).',
    );
  }
}

/** House defaults, minus the keys that only make sense for the command line. */
function houseConfig() {
  try {
    const raw = JSON.parse(readFileSync(join(repoRoot, 'report-qa.config.json'), 'utf8'));
    delete raw._comment;
    delete raw.failOn;
    return raw;
  } catch {
    return {};
  }
}

async function build({ outFile }) {
  const esbuild = loadEsbuild();

  const result = await esbuild.build({
    entryPoints: [join(here, 'browser', 'app.mjs')],
    bundle: true,
    format: 'iife',
    target: ['es2022'],
    platform: 'browser',
    minify: true,
    write: false,
    legalComments: 'none',
    define: {
      __HOUSE_CONFIG__: JSON.stringify(houseConfig()),
    },
  });

  const bundle = result.outputFiles[0].text;

  // A stray </script> inside the bundle would close the inline script early.
  const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');

  const template = readFileSync(join(here, 'browser', 'template.html'), 'utf8');
  if (!template.includes('__BUNDLE__')) {
    throw new Error('template.html no longer contains the __BUNDLE__ placeholder.');
  }
  const html = template.replace('__BUNDLE__', () => safeBundle);

  // The page must be genuinely self-contained. Anything that would reach the
  // network at runtime defeats the reason for building it this way, so fail the
  // build rather than ship a page that quietly phones home.
  const external = [
    [/\bsrc\s*=\s*["']https?:/i, 'an external script'],
    [/\bhref\s*=\s*["']https?:/i, 'an external stylesheet or link'],
    [/\bfetch\s*\(/, 'a fetch() call'],
    [/XMLHttpRequest/, 'an XMLHttpRequest'],
    [/new\s+WebSocket/, 'a WebSocket'],
    [/@import\s+url/i, 'a CSS @import'],
  ];
  for (const [pattern, description] of external) {
    if (pattern.test(html)) {
      throw new Error(`Refusing to write the page: it contains ${description}, so it would not be offline-only.`);
    }
  }

  writeFileSync(outFile, html, 'utf8');
  return { html, bundleBytes: Buffer.byteLength(safeBundle), totalBytes: Buffer.byteLength(html) };
}

function parseArgs(argv) {
  const options = { outFile: join(repoRoot, 'report-qa.html') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') {
      const value = argv[i + 1];
      if (!value) throw new Error('--out needs a path.');
      options.outFile = resolve(process.cwd(), value);
      i += 1;
    } else {
      throw new Error(`Unknown option ${argv[i]}.`);
    }
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const { bundleBytes, totalBytes } = await build(options);
  const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
  process.stdout.write(
    `Built ${options.outFile}\n`
    + `  engine ${kb(bundleBytes)}, page ${kb(totalBytes)} - self-contained, no network access\n`,
  );
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
