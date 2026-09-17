/**
 * Writing quality.
 *
 * Calibrated for advisory deliverables: the checks reward short, concrete,
 * attributable statements and flag the habits that make a report read as
 * padded or non-committal. Density-based rules report once per section rather
 * than once per word, so a reviewer gets a judgement, not a word cloud.
 */

import {
  ABSOLUTES,
  BE_FORMS,
  CONFUSABLES,
  EMPTY_INTENSIFIERS,
  HEDGES,
  IMPERATIVE_VERBS,
  IRREGULAR_PARTICIPLES,
  VAGUE_QUANTIFIERS,
  WORDINESS,
} from '../data/language.mjs';
import { countWords, fleschReadingEase } from '../text.mjs';

const PROSE = ['paragraph', 'listItem'];
const SCOPE = [...PROSE, 'caption', 'tableRow'];

export const rules = [
  {
    id: 'language/sentence-length',
    title: 'Sentence is too long',
    category: 'Readability',
    severity: 'minor',
    check(doc, ctx) {
      const limit = ctx.config.readability.maxSentenceWords;
      const findings = [];
      for (const sentence of doc.sentences()) {
        const words = countWords(sentence.text);
        if (words <= limit) continue;
        findings.push({
          start: sentence.start,
          end: sentence.end,
          message: `${words}-word sentence (house limit ${limit}).`,
          suggestion: 'Split at the first conjunction or semicolon.',
          severity: words > limit * 1.6 ? 'major' : 'minor',
        });
      }
      return findings;
    },
  },

  {
    id: 'language/paragraph-length',
    title: 'Paragraph is too long',
    category: 'Readability',
    severity: 'nit',
    check(doc, ctx) {
      const limit = ctx.config.readability.maxParagraphWords;
      return doc.blocks
        .filter((b) => b.type === 'paragraph' && countWords(b.text) > limit)
        .map((b) => ({
          start: b.start,
          end: b.end,
          message: `${countWords(b.text)}-word paragraph (house limit ${limit}). Long paragraphs are skipped by executive readers.`,
        }));
    },
  },

  {
    id: 'language/readability',
    title: 'Section is harder to read than the house target',
    category: 'Readability',
    severity: 'minor',
    check(doc, ctx) {
      const target = ctx.config.readability.minFleschExecutiveSummary;
      const findings = [];
      const headings = doc.headings();
      for (let i = 0; i < headings.length; i += 1) {
        const heading = headings[i];
        if (!/executive summary|management summary|overview|key findings/i.test(heading.text)) continue;
        const next = headings[i + 1];
        const sentences = doc.sentences().filter((s) => s.start > heading.end && (!next || s.start < next.start));
        if (sentences.length < 3) continue;
        const score = fleschReadingEase(sentences);
        if (score === null || score >= target) continue;
        findings.push({
          start: heading.start,
          end: heading.end,
          message: `"${heading.text.trim()}" scores ${score.toFixed(0)} on Flesch Reading Ease; the house target for a board-facing summary is ${target} or above.`,
          suggestion: 'Shorten sentences and replace multi-syllable abstractions with plain words.',
          documentLevel: true,
        });
      }
      return findings;
    },
  },

  {
    id: 'language/passive-voice',
    title: 'Passive voice',
    category: 'Style',
    severity: 'nit',
    check(doc, ctx) {
      const maxRatio = ctx.config.readability.maxPassiveRatio;
      const findings = [];
      const passives = [];
      const bePattern = new RegExp(`\\b(${BE_FORMS.join('|')})\\s+(?:\\w+ly\\s+)?(\\w+(?:ed|en))\\b(?:\\s+by\\b)?`, 'gi');

      for (const { match, start, end } of doc.scan(bePattern, { types: PROSE })) {
        const participle = match[2].toLowerCase();
        // "-ed" is also a simple past; require a plausible participle.
        if (!participle.endsWith('ed') && !IRREGULAR_PARTICIPLES.has(participle)) continue;
        if (/^(?:need|us|red|bed|speed|seed|indeed|embed|exceed|proceed|succeed)$/.test(participle)) continue;
        passives.push({ start, end, text: match[0] });
      }

      const sentences = doc.sentences();
      if (!sentences.length) return findings;
      const ratio = passives.length / sentences.length;

      // Recommendations should be imperative regardless of the overall ratio.
      const headings = doc.headings();
      for (const passive of passives) {
        const heading = nearestHeadingBefore(headings, passive.start);
        if (heading && /recommend|remediat|action|next steps/i.test(heading.text)) {
          findings.push({
            start: passive.start,
            end: passive.end,
            message: `Passive construction ("${passive.text.trim()}") in a recommendation.`,
            suggestion: 'Recommendations read better as imperatives: "Enable MFA on all administrative accounts."',
            severity: 'minor',
          });
        }
      }

      if (ratio > maxRatio && passives.length >= 5) {
        findings.push({
          start: passives[0].start,
          end: passives[0].end,
          message: `Passive voice in roughly ${(ratio * 100).toFixed(0)}% of sentences (house target is under ${(maxRatio * 100).toFixed(0)}%). ${passives.length} constructions found.`,
          note: 'Passive phrasing hides who must act, which matters most in findings and recommendations.',
          aggregate: true,
          occurrences: passives.length,
          documentLevel: true,
        });
      }
      return findings;
    },
  },

  {
    id: 'language/hedging',
    title: 'Hedged language',
    category: 'Style',
    severity: 'minor',
    check(doc, ctx) {
      const limit = ctx.config.readability.maxHedgesPerHundredWords;
      const pattern = new RegExp(`\\b(${HEDGES.map(escapeWords).join('|')})\\b`, 'gi');
      const hits = [...doc.scan(pattern, { types: PROSE })];
      if (!hits.length) return [];
      const words = countWords(doc.blocks.filter((b) => PROSE.includes(b.type)).map((b) => b.text).join(' '));
      if (!words) return [];
      const density = (hits.length / words) * 100;

      const findings = [];
      // A hedge inside a recommendation is a problem on its own.
      const headings = doc.headings();
      for (const hit of hits) {
        const heading = nearestHeadingBefore(headings, hit.start);
        if (!heading || !/recommend|remediat|action|next steps/i.test(heading.text)) continue;
        findings.push({
          start: hit.start,
          end: hit.end,
          message: `Hedge ("${hit.match[0]}") inside a recommendation.`,
          suggestion: 'State the recommendation as a definite action; put the uncertainty in the risk rating instead.',
        });
      }

      if (density > limit) {
        findings.push({
          start: hits[0].start,
          end: hits[0].end,
          message: `${hits.length} hedging words across ${words} words (${density.toFixed(1)} per 100, house limit ${limit}).`,
          note: 'Sustained hedging reads as a report that will not commit to its own conclusions.',
          aggregate: true,
          occurrences: hits.length,
          documentLevel: true,
        });
      }
      return findings;
    },
  },

  {
    id: 'language/absolute-claim',
    title: 'Unsupportable absolute claim',
    category: 'Advisory quality',
    severity: 'major',
    check(doc) {
      const findings = [];
      for (const entry of ABSOLUTES) {
        for (const { match, start, end } of doc.scan(entry.pattern, { types: SCOPE })) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" - ${entry.message}`,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'language/wordiness',
    title: 'Wordy phrase with a shorter equivalent',
    category: 'Style',
    severity: 'nit',
    fixable: false,
    check(doc) {
      const findings = [];
      for (const entry of WORDINESS) {
        for (const { match, start, end } of doc.scan(entry.pattern, { types: SCOPE })) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" → ${entry.replacement}`,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'language/vague-quantifier',
    title: 'Vague quantifier where a number belongs',
    category: 'Advisory quality',
    severity: 'minor',
    check(doc) {
      const findings = [];
      const quantifier = VAGUE_QUANTIFIERS.map(escapeWords).join('|');
      // Only flag when the vague word qualifies something countable.
      const pattern = new RegExp(`\\b(${quantifier})\\s+(?:of\\s+(?:the\\s+)?)?(accounts?|servers?|hosts?|endpoints?|users?|systems?|devices?|assets?|findings?|vulnerabilit(?:y|ies)|controls?|policies|applications?|databases?|sites?|workstations?|mailboxes)\\b`, 'gi');
      for (const { match, start, end } of doc.scan(pattern, { types: SCOPE })) {
        findings.push({
          start,
          end,
          message: `"${match[0]}" - give the count.`,
          suggestion: `e.g. "47 ${match[2]}"`,
          note: 'A client cannot size the remediation effort from "several".',
        });
      }
      return findings;
    },
  },

  {
    id: 'language/empty-intensifier',
    title: 'Intensifier that adds no information',
    category: 'Style',
    severity: 'nit',
    check(doc) {
      const pattern = new RegExp(`\\b(${EMPTY_INTENSIFIERS.map(escapeWords).join('|')})\\s+(\\w+)`, 'gi');
      return [...doc.scan(pattern, { types: SCOPE })]
        // "rather than" is a comparison, not an intensified "than".
        .filter(({ match }) => !/^rather$/i.test(match[1]) || !/^than$/i.test(match[2]))
        .map(({ match, start, end }) => ({
          start,
          end,
          message: `"${match[0]}" - "${match[2]}" is stronger without the intensifier.`,
        }));
    },
  },

  {
    id: 'language/confusable',
    title: 'Commonly confused word',
    category: 'Grammar',
    severity: 'major',
    check(doc) {
      const findings = [];
      for (const entry of CONFUSABLES) {
        for (const { match, start, end } of doc.scan(entry.pattern, { types: SCOPE })) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" - ${entry.message}`,
            severity: entry.severity || (entry.always ? 'major' : 'nit'),
            confidence: entry.always ? 'high' : 'low',
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'language/repeated-sentence-opener',
    title: 'Consecutive sentences open with the same word',
    category: 'Style',
    severity: 'nit',
    check(doc) {
      const findings = [];
      const sentences = doc.sentences();
      let run = [];
      const flush = () => {
        if (run.length >= 3) {
          findings.push({
            start: run[0].start,
            end: run[run.length - 1].end,
            message: `${run.length} consecutive sentences start with "${firstWord(run[0].text)}".`,
            suggestion: 'Vary the openings so the section does not read as a list in disguise.',
          });
        }
        run = [];
      };
      for (let i = 0; i < sentences.length; i += 1) {
        const word = firstWord(sentences[i].text).toLowerCase();
        const previous = run.length ? firstWord(run[run.length - 1].text).toLowerCase() : null;
        const adjacent = run.length ? sentences[i].block === run[run.length - 1].block : true;
        if (word && word === previous && adjacent) run.push(sentences[i]);
        else { flush(); run = [sentences[i]]; }
      }
      flush();
      return findings;
    },
  },

  {
    id: 'language/recommendation-not-imperative',
    title: 'Recommendation does not start with a verb',
    category: 'Advisory quality',
    severity: 'minor',
    check(doc, ctx) {
      if (!ctx.config.checkRecommendations) return [];
      const findings = [];
      const headings = doc.headings();
      for (const block of doc.blocks) {
        if (block.type !== 'listItem') continue;
        const heading = nearestHeadingBefore(headings, block.start);
        if (!heading || !/recommend|remediat|action|next steps/i.test(heading.text)) continue;
        const text = block.text.trim().replace(/^[\d.)\s]+/, '');
        if (text.length < 15) continue;
        const opener = firstWord(text);
        const first = opener.toLowerCase().replace(/[^a-z]/g, '');
        if (IMPERATIVE_VERBS.has(first)) continue;

        // Rather than guess at every verb in English, flag only the openings
        // that definitely are not imperative: a determiner, a pronoun, or a
        // gerund ("Implementing MFA would...") that buries the action.
        const NON_IMPERATIVE = /^(?:the|a|an|this|these|those|there|it|they|we|our|your|client|consideration)$/;
        const gerund = /^[a-z]{4,}ing$/.test(first) && !/^(?:bring|during|string)$/.test(first);
        if (!NON_IMPERATIVE.test(first) && !gerund) continue;

        findings.push({
          start: block.start,
          end: block.start + opener.length,
          message: gerund
            ? `Recommendation opens with the gerund "${opener}", which turns the action into a topic.`
            : `Recommendation opens with "${opener}" rather than an action verb.`,
          suggestion: 'Open with the action: "Deploy...", "Restrict...", "Document...".',
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'language/tense-consistency',
    title: 'Findings mix past and present tense',
    category: 'Style',
    severity: 'nit',
    check(doc) {
      const past = [...doc.scan(/\b(?:was|were)\s+(?:observed|identified|found|noted|reported|seen)\b/gi, { types: PROSE })];
      const present = [...doc.scan(/\b(?:is|are)\s+(?:observed|identified|found|noted|reported|seen)\b/gi, { types: PROSE })];
      if (!past.length || !present.length) return [];
      const offenders = past.length >= present.length ? present : past;
      return [{
        start: offenders[0].start,
        end: offenders[0].end,
        message: `Findings are written in past tense ${past.length} time${past.length === 1 ? '' : 's'} and present tense ${present.length} time${present.length === 1 ? '' : 's'}. Pick one - past tense is conventional for what an assessment observed.`,
        aggregate: true,
        occurrences: offenders.length,
      }];
    },
  },

  {
    id: 'language/etc-in-technical-list',
    title: '"etc." in a technical list',
    category: 'Advisory quality',
    severity: 'nit',
    check(doc) {
      return [...doc.scan(/\betc\.?\b|\band so on\b|\band more\b/gi, { types: SCOPE })].map(({ match, start, end }) => ({
        start,
        end,
        message: `"${match[0]}" leaves the reader guessing what else is in scope.`,
        suggestion: 'List the items, or say "including but not limited to" and give the selection criteria.',
      }));
    },
  },
];

function firstWord(text) {
  return (text.trim().match(/^[\w'’-]+/) || [''])[0];
}

function escapeWords(phrase) {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function nearestHeadingBefore(headings, offset) {
  let found = null;
  for (const heading of headings) {
    if (heading.start < offset) found = heading;
    else break;
  }
  return found;
}
