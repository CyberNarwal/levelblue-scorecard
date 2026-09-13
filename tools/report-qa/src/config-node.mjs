/**
 * Configuration loading from disk. Kept apart from `config.mjs` so the rule
 * engine stays free of Node APIs and can be bundled for the browser.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { DEFAULT_CONFIG, merge, validate } from './config.mjs';

/**
 * Load configuration, layering: defaults <- config file <- CLI overrides.
 * Returns { config, configPath } so the report can say where the rules came from.
 */
export function loadConfig({ configPath, overrides = {}, cwd = process.cwd() } = {}) {
  let fileConfig = {};
  let resolved = null;

  const candidates = configPath
    ? [resolve(cwd, configPath)]
    : searchUpwards(cwd, 'report-qa.config.json');

  for (const candidate of candidates) {
    try {
      fileConfig = JSON.parse(readFileSync(candidate, 'utf8'));
      resolved = candidate;
      break;
    } catch (error) {
      if (configPath) throw new Error(`Could not read config ${candidate}: ${error.message}`);
    }
  }

  const config = merge(merge(DEFAULT_CONFIG, fileConfig), overrides);
  validate(config);
  return { config, configPath: resolved };
}

function searchUpwards(from, filename) {
  const found = [];
  let current = resolve(from);
  for (let i = 0; i < 6; i += 1) {
    found.push(resolve(current, filename));
    found.push(resolve(current, 'tools', 'report-qa', filename));
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return found;
}
