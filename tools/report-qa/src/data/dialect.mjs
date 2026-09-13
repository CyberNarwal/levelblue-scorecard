/**
 * British/American spelling data.
 *
 * Two mechanisms, because neither alone is accurate enough:
 *
 *  1. EXPLICIT_PAIRS - hand-checked word pairs. Used for the -our/-or, -re/-er,
 *     -ce/-se, double-L and irregular families, where a naive suffix rule
 *     produces nonsense ("rigorous" is -or in both dialects; "humour" is not).
 *
 *  2. The -ise/-ize suffix rule, guarded by ALWAYS_ISE / ALWAYS_IZE. Almost
 *     every -ise/-ize verb follows the pattern, but a closed set of words
 *     ("exercise", "comprise", "advertise") is -ise in American English too,
 *     and flagging those is the fastest way to lose a reviewer's trust.
 */

/**
 * Verbs and nouns that end in -ise in BOTH dialects. Never flag these.
 * (Their -ising/-ised/-isement forms are handled by stem matching.)
 */
export const ALWAYS_ISE = new Set([
  'advertise', 'advise', 'apprise', 'arise', 'chastise', 'circumcise',
  'comprise', 'compromise', 'demise', 'despise', 'devise', 'disguise',
  'enterprise', 'excise', 'exercise', 'franchise', 'guise', 'improvise',
  'incise', 'merchandise', 'mise', 'paradise', 'precise', 'premise',
  'promise', 'raise', 'reprise', 'revise', 'rise', 'supervise', 'surmise',
  'surprise', 'televise', 'treatise', 'wise', 'otherwise', 'likewise',
  'clockwise', 'concise', 'noise', 'poise', 'praise', 'cruise', 'bruise',
]);

/** Words that end in -ize in BOTH dialects. Never "correct" these to -ise. */
export const ALWAYS_IZE = new Set(['capsize', 'prize', 'size', 'seize', 'assize', 'downsize', 'resize', 'oversize']);

/**
 * Hand-checked pairs: { gb, us, note?, confidence? }
 * `confidence: 'low'` means the pair is context-dependent and the finding is
 * advisory rather than a straight correction.
 */
export const EXPLICIT_PAIRS = [
  // -our / -or
  { gb: 'colour', us: 'color' },
  { gb: 'behaviour', us: 'behavior' },
  { gb: 'favour', us: 'favor' },
  { gb: 'favourable', us: 'favorable' },
  { gb: 'honour', us: 'honor' },
  { gb: 'labour', us: 'labor' },
  { gb: 'neighbour', us: 'neighbor' },
  { gb: 'endeavour', us: 'endeavor' },
  { gb: 'flavour', us: 'flavor' },
  { gb: 'harbour', us: 'harbor' },
  { gb: 'humour', us: 'humor' },
  { gb: 'odour', us: 'odor' },
  { gb: 'rumour', us: 'rumor' },
  { gb: 'savour', us: 'savor' },
  { gb: 'vapour', us: 'vapor' },
  { gb: 'valour', us: 'valor' },
  { gb: 'armour', us: 'armor' },
  { gb: 'ardour', us: 'ardor' },
  { gb: 'candour', us: 'candor' },
  { gb: 'clamour', us: 'clamor' },
  { gb: 'demeanour', us: 'demeanor' },
  { gb: 'fervour', us: 'fervor' },
  { gb: 'rigour', us: 'rigor' },
  { gb: 'splendour', us: 'splendor' },
  { gb: 'tumour', us: 'tumor' },
  { gb: 'vigour', us: 'vigor' },
  { gb: 'parlour', us: 'parlor' },
  { gb: 'saviour', us: 'savior' },
  { gb: 'colourful', us: 'colorful' },
  { gb: 'behavioural', us: 'behavioral' },
  { gb: 'behaviourally', us: 'behaviorally' },

  // -re / -er
  { gb: 'centre', us: 'center' },
  { gb: 'centred', us: 'centered' },
  { gb: 'centres', us: 'centers' },
  { gb: 'theatre', us: 'theater' },
  { gb: 'fibre', us: 'fiber' },
  { gb: 'calibre', us: 'caliber' },
  { gb: 'litre', us: 'liter' },
  { gb: 'sombre', us: 'somber' },
  { gb: 'spectre', us: 'specter' },
  { gb: 'lustre', us: 'luster' },
  { gb: 'manoeuvre', us: 'maneuver' },
  { gb: 'sceptre', us: 'scepter' },
  { gb: 'meagre', us: 'meager' },
  { gb: 'metre', us: 'meter', confidence: 'low', note: 'UK uses "metre" for the unit but "meter" for a measuring device.' },

  // -ce / -se
  { gb: 'defence', us: 'defense' },
  { gb: 'offence', us: 'offense' },
  { gb: 'pretence', us: 'pretense' },
  { gb: 'licence', us: 'license', confidence: 'low', note: 'UK: "licence" is the noun, "license" the verb. US uses "license" for both.' },
  { gb: 'practise', us: 'practice', confidence: 'low', note: 'UK: "practise" is the verb, "practice" the noun. US uses "practice" for both.' },

  // Doubled consonants
  { gb: 'cancelled', us: 'canceled' },
  { gb: 'cancelling', us: 'canceling' },
  { gb: 'labelled', us: 'labeled' },
  { gb: 'labelling', us: 'labeling' },
  { gb: 'modelled', us: 'modeled' },
  { gb: 'modelling', us: 'modeling' },
  { gb: 'travelled', us: 'traveled' },
  { gb: 'travelling', us: 'traveling' },
  { gb: 'signalled', us: 'signaled' },
  { gb: 'signalling', us: 'signaling' },
  { gb: 'totalled', us: 'totaled' },
  { gb: 'fuelled', us: 'fueled' },
  { gb: 'counsellor', us: 'counselor' },
  { gb: 'marvellous', us: 'marvelous' },
  { gb: 'enrolment', us: 'enrollment' },
  { gb: 'enrol', us: 'enroll' },
  { gb: 'fulfil', us: 'fulfill' },
  { gb: 'fulfilment', us: 'fulfillment' },
  { gb: 'instalment', us: 'installment' },
  { gb: 'skilful', us: 'skillful' },
  { gb: 'distil', us: 'distill' },
  { gb: 'appal', us: 'appall' },

  // -yse / -yze. These cannot come from the -ise/-ize suffix rule (the stem
  // ends in y, not i), so every inflection is listed explicitly.
  { gb: 'analyse', us: 'analyze' },
  { gb: 'analysed', us: 'analyzed' },
  { gb: 'analyses', us: 'analyzes' },
  { gb: 'analysing', us: 'analyzing' },
  { gb: 'paralyse', us: 'paralyze' },
  { gb: 'paralysed', us: 'paralyzed' },
  { gb: 'catalyse', us: 'catalyze' },
  { gb: 'catalysed', us: 'catalyzed' },

  // -ogue / -og
  { gb: 'catalogue', us: 'catalog' },
  { gb: 'dialogue', us: 'dialog', confidence: 'low', note: 'UI elements are "dialog box" in both dialects.' },
  { gb: 'analogue', us: 'analog' },

  // -ae- / -oe-
  { gb: 'encyclopaedia', us: 'encyclopedia' },
  { gb: 'manoeuvring', us: 'maneuvering' },
  { gb: 'oestrogen', us: 'estrogen' },

  // Irregulars that matter in professional prose
  { gb: 'grey', us: 'gray' },
  { gb: 'cheque', us: 'check', confidence: 'low', note: 'Only for the payment instrument.' },
  { gb: 'artefact', us: 'artifact' },
  { gb: 'artefacts', us: 'artifacts' },
  { gb: 'ageing', us: 'aging' },
  { gb: 'judgement', us: 'judgment', confidence: 'low', note: 'UK legal writing uses "judgment"; general UK usage allows both.' },
  { gb: 'acknowledgement', us: 'acknowledgment' },
  { gb: 'programme', us: 'program', confidence: 'low', note: 'UK uses "program" for computer programs and "programme" for a plan of work.' },
  { gb: 'storey', us: 'story', confidence: 'low', note: 'Only for a floor of a building.' },
  { gb: 'sulphur', us: 'sulfur' },
  { gb: 'aluminium', us: 'aluminum' },
  { gb: 'draught', us: 'draft', confidence: 'low' },
  { gb: 'mould', us: 'mold' },
  { gb: 'kerb', us: 'curb', confidence: 'low', note: 'Only for the edge of a pavement.' },
  { gb: 'tyre', us: 'tire', confidence: 'low' },
  { gb: 'jewellery', us: 'jewelry' },
  { gb: 'speciality', us: 'specialty' },
  { gb: 'whilst', us: 'while' },
  { gb: 'amongst', us: 'among' },
  { gb: 'learnt', us: 'learned' },
  { gb: 'spelt', us: 'spelled' },
  { gb: 'burnt', us: 'burned', confidence: 'low' },
  { gb: 'dreamt', us: 'dreamed' },
  { gb: 'leapt', us: 'leaped' },
  { gb: 'towards', us: 'toward', confidence: 'low', note: 'Both are acceptable in both dialects; flagged only for internal consistency.' },
  { gb: 'cyber security', us: 'cybersecurity', confidence: 'low', note: 'NCSC (UK) writes "cyber security"; CISA (US) writes "cybersecurity". Pick one and hold it.' },
];

/**
 * Build fast lookup maps. Keys are lowercase; values carry the counterpart and
 * any caveat so the rule can explain itself.
 */
export function buildDialectIndex() {
  const gb = new Map();
  const us = new Map();
  for (const pair of EXPLICIT_PAIRS) {
    gb.set(pair.gb.toLowerCase(), pair);
    us.set(pair.us.toLowerCase(), pair);
  }
  return { gb, us };
}

/**
 * Apply the -ise/-ize suffix rule to a single word.
 * Returns { dialect, counterpart } or null when the word is dialect-neutral.
 */
export function suffixDialect(word) {
  const lower = word.toLowerCase();
  if (lower.length < 5) return null;

  // The capture group after the stem absorbs the inflection, so "organised",
  // "organising" and "organisation" all resolve against the same stem.
  const izeMatch = lower.match(/^(.*?)(iz)(e|es|ed|ing|er|ers|ation|ations|ational)$/);
  if (izeMatch) {
    const stem = `${izeMatch[1]}ise`;
    if (ALWAYS_IZE.has(stem.replace(/ise$/, 'ize')) || ALWAYS_IZE.has(lower)) return null;
    if (izeMatch[1].length < 2) return null;
    return { dialect: 'en-US', counterpart: word.replace(/iz/i, (m) => (m === 'IZ' ? 'IS' : 'is')) };
  }

  const iseMatch = lower.match(/^(.*?)(is)(e|es|ed|ing|er|ers|ation|ations|ational)$/);
  if (iseMatch) {
    const stem = `${iseMatch[1]}ise`;
    if (ALWAYS_ISE.has(stem) || ALWAYS_ISE.has(lower)) return null;
    if (iseMatch[1].length < 2) return null;
    return { dialect: 'en-GB', counterpart: word.replace(/is(?=[e]|ation)/i, (m) => (m === 'IS' ? 'IZ' : 'iz')) };
  }

  return null;
}

/** Date formats. UK: 12 March 2026. US: March 12, 2026. */
export const DATE_PATTERNS = {
  dayMonthYear: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
  monthDayYear: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi,
  ambiguousNumeric: /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g,
};
