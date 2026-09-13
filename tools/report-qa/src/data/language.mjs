/**
 * Writing-quality word lists.
 *
 * These are tuned for consulting deliverables rather than general prose: the
 * failure modes that matter in an advisory report are hedged recommendations,
 * unfalsifiable claims, absolute promises that create liability, and filler
 * that pads a findings section without adding information.
 */

/** Pairs a spell checker cannot catch, because both spellings are real words. */
export const CONFUSABLES = [
  { pattern: /\bit's\b/g, message: '"it\'s" is "it is"/"it has". The possessive is "its".', check: 'its' },
  { pattern: /\bits'\b/g, message: '"its\'" is never correct. Use "its" (possessive) or "it\'s" (it is).', always: true },
  { pattern: /\beffect(?:ing|ed)\b/gi, message: '"effect" as a verb means "to bring about". For "to influence", use "affect".' },
  { pattern: /\ban affect\b|\bthe affect\b|\bthis affect\b/gi, message: 'As a noun, the usual word is "effect".', always: true },
  { pattern: /\bcomprised of\b/gi, message: '"Comprised of" is disputed. Use "composed of" or "comprises".', always: true },
  { pattern: /\bprincipal\b/gi, message: 'Check: "principal" is chief/primary; "principle" is a rule or standard.' },
  { pattern: /\bprinciple\s+(?:reason|cause|finding|risk|objective|concern)\b/gi, message: 'Should be "principal" (= main) before a noun like this.', always: true },
  { pattern: /\bdiscrete\b/gi, message: 'Check: "discrete" is separate/distinct; "discreet" is careful about secrecy.' },
  { pattern: /\bcompliment(?:ary|s|ed|ing)?\b/gi, message: 'Check: "complimentary" is free/praising; "complementary" completes something.' },
  { pattern: /\binsure\s+that\b/gi, message: 'Use "ensure that" - "insure" relates to insurance policies.', always: true },
  { pattern: /\bloose\s+(?:control|access|data|credentials|money|time)\b/gi, message: 'Should be "lose".', always: true },
  { pattern: /\bthen\s+(?:the|a|an)?\s*\w+\s+(?:is|are|was|were)\s+(?:more|less|better|worse|higher|lower)\b/gi, message: 'Check "then" vs "than" in comparisons.' },
  { pattern: /\brather then\b|\bmore then\b|\bless then\b|\bother then\b/gi, message: 'Should be "than", not "then".', always: true },
  { pattern: /\bbreech(?:es|ed)?\b/gi, message: 'A security incident is a "breach". "Breech" is the rear of a gun barrel.', always: true },
  { pattern: /\bloosing\b/gi, message: 'Should be "losing".', always: true },
  { pattern: /\bthere own\b|\bthere is\s+\w+\s+own\b/gi, message: 'Should be "their own".', always: true },
  { pattern: /\byour\s+(?:welcome|the\s)/gi, message: 'Check "your" vs "you\'re".' },
  { pattern: /\bper say\b/gi, message: 'The Latin phrase is "per se".', always: true },
  { pattern: /\bdefinately\b|\bseperate\b|\boccured\b|\brecieve\b|\bacheive\b|\bpublically\b|\baccomodate\b|\bmaintainance\b|\bexistance\b|\bindependant\b|\bneccessary\b|\boccurance\b|\bpriviledge\b|\bvulnerabilty\b|\bvulnerablity\b|\bthreshhold\b|\bmispelled\b/gi, message: 'Misspelling.', always: true, severity: 'major' },
  { pattern: /\bcyber\s+attack\b/gi, message: 'Usually written as one word: "cyberattack" (or "cyber attack" in UK house style - be consistent).' },
  { pattern: /\bad-hoc\b/gi, message: 'Usually "ad hoc" (unhyphenated) in British and American style guides.' },
];

/** Hedges. A few are fine; a cluster reads as an unwilling recommendation. */
export const HEDGES = [
  'may', 'might', 'could', 'possibly', 'perhaps', 'arguably', 'seemingly',
  'apparently', 'presumably', 'somewhat', 'fairly', 'relatively', 'generally',
  'typically', 'often', 'sometimes', 'appears to', 'seems to', 'tends to',
  'in some cases', 'to some extent', 'it is possible that', 'we believe',
  'it would appear', 'reasonably', 'broadly', 'largely', 'more or less',
];

/**
 * Absolute claims. In an advisory report these create commercial and legal
 * exposure: no control "guarantees" or "eliminates" risk.
 */
export const ABSOLUTES = [
  { pattern: /\b(?:will|shall)\s+(?:prevent|eliminate|stop|guarantee|ensure)\s+(?:all|any|every)\b/gi, message: 'Absolute guarantee. No control prevents all instances of anything - soften to "significantly reduces the likelihood of".' },
  { pattern: /\bguarantee(?:s|d)?\b/gi, message: 'Avoid "guarantee" in security advice - it implies a commitment the report cannot support.' },
  { pattern: /\b100%\s+(?:secure|effective|coverage|compliant|protected)\b/gi, message: 'Unsupportable absolute claim.' },
  { pattern: /\b(?:completely|fully|totally|entirely)\s+(?:secure|protected|mitigated|eliminated|remediated)\b/gi, message: 'Absolute claim - prefer a bounded statement of residual risk.' },
  { pattern: /\bunhackable\b|\bimpenetrable\b|\bbulletproof\b|\bfool\s?proof\b/gi, message: 'Unsupportable claim.' },
  { pattern: /\bzero\s+risk\b|\bno\s+risk\b(?!\s+(?:appetite|register|owner|rating))/gi, message: 'Residual risk is never zero - state it as "residual risk is low".' },
  { pattern: /\beliminates?\s+the\s+risk\b/gi, message: 'Controls reduce risk; they rarely eliminate it.' },
];

/** Wordiness with a shorter equivalent. */
export const WORDINESS = [
  { pattern: /\bin order to\b/gi, replacement: 'to' },
  { pattern: /\bdue to the fact that\b/gi, replacement: 'because' },
  { pattern: /\bin the event that\b/gi, replacement: 'if' },
  { pattern: /\bat this point in time\b/gi, replacement: 'now' },
  { pattern: /\bfor the purpose of\b/gi, replacement: 'to' },
  { pattern: /\bwith regard to\b|\bwith respect to\b|\bin relation to\b/gi, replacement: 'about / for' },
  { pattern: /\bit should be noted that\b/gi, replacement: '(delete - state the point directly)' },
  { pattern: /\bit is important to note that\b/gi, replacement: '(delete - state the point directly)' },
  { pattern: /\bthe fact that\b/gi, replacement: 'that' },
  { pattern: /\ba (?:large|small|significant) number of\b/gi, replacement: 'many / few / a stated count' },
  { pattern: /\bin the near future\b/gi, replacement: 'a dated commitment' },
  { pattern: /\bprior to\b/gi, replacement: 'before' },
  { pattern: /\bsubsequent to\b/gi, replacement: 'after' },
  { pattern: /\bin conjunction with\b/gi, replacement: 'with' },
  { pattern: /\bon a (?:regular|monthly|weekly|daily|quarterly) basis\b/gi, replacement: 'regularly / monthly / weekly' },
  { pattern: /\bhas the ability to\b|\bhas the capability to\b/gi, replacement: 'can' },
  { pattern: /\bis able to\b|\bare able to\b/gi, replacement: 'can' },
  { pattern: /\bat the present time\b/gi, replacement: 'currently' },
  { pattern: /\bin spite of the fact that\b/gi, replacement: 'although' },
  { pattern: /\bmake a decision\b/gi, replacement: 'decide' },
  { pattern: /\bprovide assistance\b/gi, replacement: 'help' },
  { pattern: /\bconduct an assessment of\b/gi, replacement: 'assess' },
  { pattern: /\bperform an analysis of\b/gi, replacement: 'analyse' },
  { pattern: /\butilis[ez]e?(?:s|d)?\b/gi, replacement: 'use' },
  { pattern: /\bleverage(?:s|d)?\b/gi, replacement: 'use' },
  { pattern: /\bgoing forward\b/gi, replacement: '(delete)' },
  { pattern: /\bbest[- ]of[- ]breed\b|\bworld[- ]class\b|\bcutting[- ]edge\b|\bstate[- ]of[- ]the[- ]art\b/gi, replacement: '(delete - marketing language)' },
  { pattern: /\bsynerg(?:y|ies|istic)\b/gi, replacement: '(delete - jargon)' },
  { pattern: /\bholistic\b/gi, replacement: 'comprehensive / end-to-end' },
  { pattern: /\bparadigm\b/gi, replacement: 'model / approach' },
  { pattern: /\bactionable insights?\b/gi, replacement: 'specific recommendations' },
  { pattern: /\blow[- ]hanging fruit\b/gi, replacement: 'quick wins (or name them)' },
  { pattern: /\bmove the needle\b|\bboil the ocean\b|\btouch base\b/gi, replacement: '(delete - idiom)' },
];

/** Vague quantifiers where a report should give a number. */
export const VAGUE_QUANTIFIERS = [
  'many', 'several', 'numerous', 'a number of', 'various', 'multiple',
  'some', 'a few', 'most', 'the majority of', 'a significant proportion',
  'a large proportion', 'widespread', 'a handful of', 'countless',
];

/** Intensifiers that add no measurable information. */
export const EMPTY_INTENSIFIERS = [
  'very', 'extremely', 'highly', 'incredibly', 'really', 'truly', 'quite',
  'rather', 'particularly', 'especially', 'critically important', 'absolutely',
];

/**
 * Common irregular past participles, so the passive-voice detector catches
 * "was written" as well as "was completed".
 */
export const IRREGULAR_PARTICIPLES = new Set([
  'been', 'begun', 'broken', 'brought', 'built', 'bought', 'caught', 'chosen',
  'come', 'done', 'drawn', 'driven', 'eaten', 'fallen', 'felt', 'found',
  'given', 'gone', 'grown', 'held', 'hidden', 'kept', 'known', 'laid', 'led',
  'left', 'lost', 'made', 'meant', 'met', 'paid', 'put', 'read', 'run', 'said',
  'seen', 'sent', 'set', 'shown', 'shut', 'sold', 'spent', 'stolen', 'taken',
  'taught', 'told', 'thought', 'understood', 'undertaken', 'won', 'written',
  'withdrawn', 'overwritten', 'rebuilt', 'rewritten', 'forgotten', 'spoken',
]);

/** Forms of "to be" that begin a passive construction. */
export const BE_FORMS = ['is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', "isn't", "aren't", "wasn't", "weren't"];

/** Verbs that make a recommendation actionable. A recommendation should start with one. */
export const IMPERATIVE_VERBS = new Set([
  'adopt', 'agree', 'align', 'apply', 'assess', 'assign', 'audit', 'automate',
  'baseline', 'block', 'build', 'centralise', 'centralize', 'configure',
  'confirm', 'consolidate', 'create', 'decommission', 'define', 'deploy',
  'design', 'develop', 'disable', 'document', 'enable', 'enforce', 'establish',
  'extend', 'formalise', 'formalize', 'harden', 'identify', 'implement',
  'improve', 'integrate', 'introduce', 'investigate', 'limit', 'maintain',
  'map', 'migrate', 'monitor', 'patch', 'perform', 'pilot', 'prioritise',
  'prioritize', 'produce', 'publish', 'record', 'reduce', 'refresh',
  'remediate', 'remove', 'replace', 'require', 'restrict', 'review', 'revoke',
  'roll', 'run', 'schedule', 'segment', 'separate', 'standardise',
  'standardize', 'test', 'track', 'train', 'update', 'upgrade', 'validate',
  'verify',
]);

/** Words that signal a sentence is stating a risk rather than an observation. */
export const RISK_SIGNALS = ['risk', 'threat', 'exposure', 'likelihood', 'impact', 'consequence', 'could result in', 'may lead to', 'exposes'];

/** Words that signal a business consequence, used to test risk-statement completeness. */
export const IMPACT_SIGNALS = [
  'financial', 'fine', 'penalty', 'regulatory', 'reputational', 'reputation',
  'downtime', 'outage', 'disruption', 'data loss', 'breach', 'exfiltration',
  'ransom', 'litigation', 'customer', 'revenue', 'contractual', 'safety',
  'availability', 'confidentiality', 'integrity', 'compliance', 'operational',
];
