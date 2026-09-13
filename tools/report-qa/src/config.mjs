/**
 * Configuration: house style defaults plus a loader that merges a project's
 * report-qa.config.json over them.
 *
 * The defaults are deliberately opinionated rather than neutral - a QA tool
 * that has no view is no use. Everything here can be overridden per report.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const DEFAULT_CONFIG = {
  /** 'en-GB' | 'en-US' | 'auto' - 'auto' infers from the draft's own spellings. */
  dialect: 'auto',

  /** Who the finished document goes to. 'client' enables release-readiness checks. */
  audience: 'client',

  /** Name that appears in the draft when the house voice is third person. */
  organisation: '',

  client: {
    name: '',
    aliases: [],
  },

  /**
   * Names that must NOT appear - previous clients whose report this draft was
   * copied from. The single most common confidentiality failure in consulting.
   */
  forbiddenClientNames: [],

  /** Marking expected on every deliverable, e.g. 'CONFIDENTIAL'. Empty disables the check. */
  classification: '',

  /** The severity vocabulary the report is allowed to use. */
  severityScale: ['Critical', 'High', 'Medium', 'Low', 'Informational'],

  /** Sections the report must contain. A nested array means "any one of these". */
  requiredSections: [],

  houseStyle: {
    /** 'curly' | 'straight' | 'auto' */
    quotes: 'auto',
    /** true | false | 'auto' */
    oxfordComma: 'auto',
    /** 'title' | 'sentence' | 'auto' */
    headingCase: 'auto',
    /** 'period' | 'none' | 'auto' */
    bulletTerminalPunctuation: 'auto',
    /** 'spaced-en' | 'closed-em' | 'spaced-em' */
    dashStyle: 'spaced-en',
    /** 'allow' | 'forbid' | 'auto' */
    firstPerson: 'auto',
    /** Spaces after a full stop. 1 is modern practice. */
    sentenceSpacing: 1,
    maxConsecutiveBlankLines: 1,
    spellOutNumbersBelowTen: false,
  },

  readability: {
    maxSentenceWords: 35,
    maxParagraphWords: 160,
    minFleschExecutiveSummary: 35,
    maxPassiveRatio: 0.25,
    maxHedgesPerHundredWords: 2.5,
  },

  /** Domain checks that are expensive in reviewer attention - on by default. */
  checkRiskStatements: true,
  checkRecommendations: true,
  requireDefangedIocs: true,
  flagPersonalData: true,

  /** Acronyms this team never expands, beyond the built-in common set. */
  knownAcronyms: [],

  /** Terms that would otherwise trip the canonical-name rule. */
  allowedTerms: [],

  /**
   * Per-rule overrides: 'off' to disable, or a severity name to re-grade.
   *   "rules": { "language/wordiness": "off", "structure/bare-url": "nit" }
   */
  rules: {},

  /** Findings at or above this severity make the CLI exit non-zero. */
  failOn: 'major',
};

const SEVERITIES = ['blocker', 'major', 'minor', 'nit'];

export function severityRank(severity) {
  const index = SEVERITIES.indexOf(severity);
  return index === -1 ? SEVERITIES.length : index;
}

export { SEVERITIES };

/** Deep merge for plain objects; arrays are replaced wholesale. */
function merge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return override ?? base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = base[key];
    if (current && typeof current === 'object' && !Array.isArray(current)
        && value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = merge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

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

function validate(config) {
  if (!['en-GB', 'en-US', 'auto'].includes(config.dialect)) {
    throw new Error(`dialect must be "en-GB", "en-US" or "auto" (got "${config.dialect}").`);
  }
  if (!SEVERITIES.includes(config.failOn) && config.failOn !== 'never') {
    throw new Error(`failOn must be one of ${SEVERITIES.join(', ')} or "never" (got "${config.failOn}").`);
  }
  for (const [rule, setting] of Object.entries(config.rules || {})) {
    if (setting !== 'off' && !SEVERITIES.includes(setting)) {
      throw new Error(`rules["${rule}"] must be "off" or a severity (got "${setting}").`);
    }
  }
}
