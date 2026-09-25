/**
 * Security-domain correctness.
 *
 * These are the findings that damage credibility most: a CVSS score that does
 * not match the severity word next to it, a CVE identifier with the wrong year,
 * a live indicator of compromise pasted in undefanged, or a severity label that
 * is not on the scale the report defines.
 */

import {
  CIS_CONTROL_COUNT,
  CSF_FUNCTIONS,
  cvssBandFor,
  IDENTIFIERS,
  NIST_53_FAMILIES,
  PCI_REQUIREMENT_COUNT,
  PRIVATE_IP,
  RETIRED_VERSIONS,
} from '../data/terms.mjs';

const SCOPE = ['paragraph', 'listItem', 'heading', 'caption', 'tableRow'];

/** NIST CSF 2.0 categories, by function. */
const CSF_CATEGORIES = {
  GV: ['OC', 'RM', 'RR', 'PO', 'OV', 'SC'],
  ID: ['AM', 'RA', 'IM'],
  PR: ['AA', 'AT', 'DS', 'PS', 'IR'],
  DE: ['CM', 'AE'],
  RS: ['MA', 'AN', 'CO', 'MI'],
  RC: ['RP', 'CO'],
};

export const rules = [
  {
    id: 'cyber/cve-format',
    title: 'Malformed CVE identifier',
    category: 'Security accuracy',
    severity: 'major',
    check(doc, ctx) {
      const findings = [];
      const thisYear = ctx.now.getUTCFullYear();
      for (const { match, start, end } of doc.scan(IDENTIFIERS.cve, { types: SCOPE, skipOpaque: false })) {
        const canonical = `CVE-${match[1]}-${match[2]}`;
        const year = Number(match[1]);
        if (match[0] !== canonical) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" is not the canonical CVE format.`,
            suggestion: canonical,
            fix: canonical,
          });
        }
        if (year < 1999 || year > thisYear + 1) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" has an implausible year (${year}). CVE IDs start at 1999.`,
            severity: 'major',
          });
        }
        if (match[2].length < 4) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" has a ${match[2].length}-digit sequence number; CVE sequence numbers are at least four digits.`,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'cyber/cvss-score',
    title: 'CVSS score problem',
    category: 'Security accuracy',
    severity: 'blocker',
    check(doc) {
      const findings = [];
      // Tolerates "CVSS 9.8", "CVSS v3.1 9.1", "CVSS v3.1 base score of 9.8",
      // "CVSS score: 7.5" - all of which appear in real vulnerability write-ups.
      const pattern = /\bCVSS\s*(?:v\.?\s?([234](?:\.\d)?))?\s*(?:base\s+)?(?:score)?\s*(?:of|is|[:=])?\s*(\d{1,2}(?:\.\d)?)\b/gi;
      // A report that states its CVSS version once, in the methodology or in a
      // vector string, has said it. Repeating the demand beside every score
      // turned one editorial point into a finding per vulnerability.
      const versionStated = /\bCVSS[\s:]*v?\.?\s?[234](?:\.\d)?\b/i.test(doc.text);
      const unversioned = [];
      for (const { match, start, end, block } of doc.scan(pattern, { types: SCOPE, skipOpaque: false })) {
        const version = match[1];
        const score = Number(match[2]);

        if (score > 10) {
          findings.push({
            start,
            end,
            message: `CVSS score of ${score} is out of range - the scale runs 0.0 to 10.0.`,
          });
          continue;
        }
        if (!version && !versionStated) unversioned.push({ start, end, score });
        if (!/\./.test(match[2])) {
          findings.push({
            start,
            end,
            message: `CVSS scores are quoted to one decimal place: "${score}" should be "${score.toFixed(1)}".`,
            suggestion: score.toFixed(1),
            severity: 'nit',
          });
        }

        // The severity word near the score must match the score's band.
        const band = cvssBandFor(score);
        const context = block.text.slice(Math.max(0, match.index - 120), match.index + match[0].length + 120);
        const stated = context.match(/\b(critical|high|medium|moderate|low|informational|info)\b/i);
        if (band && stated) {
          const statedName = normaliseSeverity(stated[1]);
          if (statedName && statedName !== band.name) {
            findings.push({
              start,
              end,
              message: `CVSS ${score.toFixed(1)} is "${band.name}" (${band.min}-${band.max}), but the text nearby says "${stated[1]}".`,
              suggestion: band.name,
              severity: 'blocker',
              note: 'A score and severity that disagree is the single most-quoted error in vulnerability reporting.',
            });
          }
        }
      }
      if (unversioned.length) {
        const first = unversioned[0];
        findings.push({
          start: first.start,
          end: first.end,
          message: `CVSS score${unversioned.length === 1 ? ' is' : 's are'} quoted without a version anywhere in the report. `
            + 'v3.1 and v4.0 scores are not interchangeable.',
          suggestion: `CVSS v3.1 base score ${first.score.toFixed(1)}`,
          severity: 'minor',
          aggregate: unversioned.length > 1,
          occurrences: unversioned.length,
          note: 'Stating the version once, in the methodology, is enough.',
        });
      }
      return findings;
    },
  },

  {
    id: 'cyber/attack-technique',
    title: 'Malformed MITRE ATT&CK technique ID',
    category: 'Security accuracy',
    severity: 'minor',
    check(doc) {
      const findings = [];
      // Only look where ATT&CK is actually in play, or T-numbers in tables will
      // collide with ticket references and asset tags.
      if (!/ATT&CK|MITRE|technique/i.test(doc.text)) return findings;
      for (const { match, start, end } of doc.scan(/\bT\s?-?\s?(\d{4})(?:\s?\.\s?(\d{1,3}))?\b/g, { types: SCOPE })) {
        const canonical = match[2] ? `T${match[1]}.${match[2].padStart(3, '0')}` : `T${match[1]}`;
        if (match[0] === canonical) continue;
        findings.push({
          start,
          end,
          message: `"${match[0]}" is not the canonical ATT&CK technique format.`,
          suggestion: canonical,
          fix: canonical,
          note: match[2] && match[2].length < 3 ? 'Sub-technique numbers are three digits (T1078.001, not T1078.1).' : undefined,
        });
      }
      return findings;
    },
  },

  {
    id: 'cyber/csf-identifier',
    title: 'Invalid NIST CSF 2.0 identifier',
    category: 'Security accuracy',
    severity: 'major',
    check(doc) {
      const findings = [];
      for (const { match, start, end } of doc.scan(/\b(GV|ID|PR|DE|RS|RC)\.([A-Z]{2})[-‐-― ](\d{1,2})\b/g, { types: SCOPE, skipOpaque: false })) {
        const [, fn, category, number] = match;
        const canonical = `${fn}.${category}-${number.padStart(2, '0')}`;
        const valid = CSF_CATEGORIES[fn];
        if (!valid.includes(category)) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" is not a NIST CSF 2.0 identifier - ${CSF_FUNCTIONS[fn]} has no category "${category}". Valid: ${valid.map((c) => `${fn}.${c}`).join(', ')}.`,
          });
          continue;
        }
        if (match[0] !== canonical) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" should be written "${canonical}".`,
            suggestion: canonical,
            fix: canonical,
            severity: 'minor',
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'cyber/iso-control-version',
    title: 'ISO/IEC 27001 control reference looks out of date',
    category: 'Security accuracy',
    severity: 'minor',
    check(doc) {
      const findings = [];
      if (!/ISO/i.test(doc.text)) return findings;
      // The 2022 revision uses two-level control numbers (A.5.1); three-level
      // numbers (A.5.1.1) belong to the withdrawn 2013 Annex A.
      for (const { match, start, end } of doc.scan(/\bA\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\b/g, { types: SCOPE, skipOpaque: false })) {
        findings.push({
          start,
          end,
          message: `"${match[0]}" is an ISO/IEC 27001:2013 Annex A reference. The 2022 revision renumbered Annex A to two levels (for example A.5.1).`,
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'cyber/severity-scale',
    title: 'Severity label is not on the report scale',
    category: 'Security accuracy',
    severity: 'major',
    check(doc, ctx) {
      const scale = (ctx.config.severityScale || []).map((s) => s.toLowerCase());
      if (!scale.length) return [];
      const findings = [];
      const seen = new Map();
      const pattern = /\b(?:severity|risk|rating|priority|impact|likelihood)\s*(?:rating|level|is|was|:|=|-)?\s*["'‘“]?([A-Za-z][A-Za-z\s]{1,18}?)["'’”]?(?=[\s.,;)\]]|$)/gi;
      for (const { match, start, end } of doc.scan(pattern, { types: SCOPE })) {
        const label = match[1].trim().toLowerCase();
        if (!label || label.length < 3) continue;
        if (scale.includes(label)) continue;
        // Only flag words that read like a severity label, not free prose.
        if (!/^(?:very\s+)?(?:extreme|severe|serious|significant|major|minor|moderate|substantial|elevated|urgent|negligible|trivial|catastrophic|high|medium|low|critical|informational|info|none)$/i.test(label)) continue;
        if (seen.has(label)) { seen.get(label).count += 1; continue; }
        seen.set(label, { start, end, count: 1 });
      }
      for (const [label, info] of seen) {
        findings.push({
          start: info.start,
          end: info.end,
          message: `"${label}" is used as a severity/risk label but is not on the report's scale (${ctx.config.severityScale.join(', ')}).`,
          suggestion: nearestScaleValue(label, ctx.config.severityScale),
          aggregate: true,
          occurrences: info.count,
        });
      }
      return findings;
    },
  },

  {
    id: 'cyber/undefanged-ioc',
    title: 'Live indicator of compromise is not defanged',
    category: 'Confidentiality',
    severity: 'major',
    check(doc, ctx) {
      if (!ctx.config.requireDefangedIocs) return [];
      const findings = [];
      const malicious = /\b(?:malicious|attacker|c2|c&c|command\s+and\s+control|phishing|exfiltration|threat\s+actor|beacon|payload|dropper)\b/i;

      for (const { match, start, end, block } of doc.scan(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, { types: SCOPE, skipOpaque: false })) {
        if (PRIVATE_IP.test(match[0])) continue;
        const octets = match[0].split('.').map(Number);
        if (octets.some((o) => o > 255)) continue;
        if (!malicious.test(block.text)) continue;
        findings.push({
          start,
          end,
          message: `Routable IP address "${match[0]}" appears in a paragraph describing malicious activity and is not defanged.`,
          suggestion: match[0].replace(/\./g, '[.]'),
          note: 'Defanging stops mail gateways, chat clients and PDF readers turning an indicator into a live link.',
        });
      }

      for (const { match, start, end } of doc.scan(/\bhttps?:\/\/\S+/gi, { types: SCOPE, skipOpaque: false })) {
        const url = match[0];
        if (/\[\.\]|hxxp/i.test(url)) continue;
        const nearby = doc.text.slice(Math.max(0, start - 150), end + 150);
        if (!malicious.test(nearby)) continue;
        findings.push({
          start,
          end,
          message: `URL "${truncate(url)}" sits in malicious-activity context and is a live, clickable link.`,
          suggestion: url.replace(/^http/i, 'hxxp').replace(/\./g, '[.]'),
        });
      }
      return findings;
    },
  },

  {
    id: 'cyber/risk-without-impact',
    title: 'Risk statement with no business consequence',
    category: 'Advisory quality',
    severity: 'minor',
    check(doc, ctx) {
      if (!ctx.config.checkRiskStatements) return [];
      const findings = [];
      const impact = new RegExp(`\\b(?:${['financial', 'fine', 'penalt', 'regulat', 'reputation', 'downtime', 'outage', 'disrupt', 'data loss', 'breach', 'exfiltrat', 'ransom', 'litigat', 'customer', 'revenue', 'contractual', 'safety', 'availability', 'confidentiality', 'integrity', 'compliance', 'operational', 'unauthorised access', 'unauthorized access'].join('|')})`, 'i');
      for (const sentence of doc.sentences()) {
        if (!/\b(?:risk|exposure|threat)\b/i.test(sentence.text)) continue;
        if (sentence.text.length < 40) continue;
        if (impact.test(sentence.text)) continue;
        // A risk sentence that never says what happens if the risk lands.
        if (!/\b(?:could|may|would|can|might)\b/i.test(sentence.text)) continue;
        findings.push({
          start: sentence.start,
          end: sentence.end,
          message: 'Risk statement does not name a business consequence.',
          suggestion: 'State cause, event and consequence: "Because X, an attacker could Y, resulting in Z."',
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'cyber/recommendation-not-actionable',
    title: 'Recommendation is not actionable',
    category: 'Advisory quality',
    severity: 'minor',
    check(doc, ctx) {
      if (!ctx.config.checkRecommendations) return [];
      const findings = [];
      const headings = doc.headings();
      for (const block of doc.blocks) {
        // Bullets only. Recommendation sections also carry framing prose, and
        // asking a lead-in sentence for an owner and a date is just noise.
        if (block.type !== 'listItem') continue;
        const heading = nearestHeadingBefore(headings, block);
        if (!heading || !/recommend|remediat|action|next steps/i.test(heading.text)) continue;
        const text = block.text.trim();
        if (text.length < 20) continue;

        const hasOwner = /\b(?:owner|responsible|accountable|assigned to|IT team|security team|[A-Z][a-z]+\s[A-Z][a-z]+)\b/.test(text);
        // Report writers say "every six months" and "each quarter" far more
        // often than "within 30 days", and reading only the digits made the
        // rule fire on recommendations that state their cadence plainly.
        const cadence = 'daily|weekly|fortnightly|monthly|quarterly|bi-annually|biannually|annually|yearly';
        const counted = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\\s*(?:hour|day|week|month|quarter|year)s?';
        const hasTimeframe = new RegExp(
          `\\b(?:${counted}|${cadence}|Q[1-4]\\b|immediately|urgently|within\\b|by\\s+\\d|`
          + 'by\\s+(?:the\\s+)?(?:end|next|start|January|February|March|April|May|June|July|August|September|October|November|December)|'
          + '(?:each|every)\\s+(?:day|week|month|quarter|year)|before\\s+(?:the\\s+)?(?:next|end|go[- ]live|issue|audit|renewal)|'
          + 'prior\\s+to|short[- ]term|medium[- ]term|long[- ]term)', 'i',
        ).test(text);
        // Only when it gives neither. A consultant rarely knows the client's
        // org chart, so a recommendation with a timescale and no named owner is
        // ordinary; one with neither is the one nobody can schedule.
        if (hasOwner || hasTimeframe) continue;
        findings.push({
          start: block.start,
          end: block.end,
          message: 'Recommendation names neither an owner nor a timeframe. A client cannot schedule this.',
          suggestion: 'Say who does it, or by when.',
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'cyber/framework-version',
    title: 'Framework version is retired or superseded',
    category: 'Security accuracy',
    severity: 'major',
    check(doc) {
      const findings = [];
      for (const entry of RETIRED_VERSIONS) {
        for (const { match, start, end } of doc.scan(entry.pattern, { types: SCOPE, skipOpaque: false })) {
          findings.push({
            start,
            end,
            message: `"${match[0].trim()}" is not the current version. ${entry.current} supersedes it.`,
            suggestion: entry.current,
            note: `${entry.note} Assessing against a retired version is sometimes deliberate - say so in the report if it is.`,
            severity: entry.severity,
            confidence: 'medium',
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'cyber/control-identifier',
    title: 'Control identifier is not on the framework it cites',
    category: 'Security accuracy',
    severity: 'major',
    check(doc) {
      const findings = [];

      // PCI DSS v4.0.1 has twelve requirements. A thirteenth is a typo, or a
      // reference to something that is not PCI DSS.
      for (const { match, start, end } of doc.scan(IDENTIFIERS.pciRequirement, { types: SCOPE, skipOpaque: false })) {
        const requirement = Number(match[1]);
        if (requirement >= 1 && requirement <= PCI_REQUIREMENT_COUNT) continue;
        findings.push({
          start,
          end,
          message: `"${match[0].trim()}" cites PCI DSS requirement ${requirement}; v4.0.1 has ${PCI_REQUIREMENT_COUNT}.`,
          note: 'Requirement numbers run 1 to 12 (PCI SSC).',
        });
      }

      // CIS Controls v8.1 has eighteen; v8 consolidated the previous twenty.
      for (const { match, start, end } of doc.scan(IDENTIFIERS.cisControl, { types: SCOPE, skipOpaque: false })) {
        const control = Number(match[1]);
        if (control >= 1 && control <= CIS_CONTROL_COUNT) continue;
        findings.push({
          start,
          end,
          message: `"${match[0].trim()}" cites CIS Control ${control}; v8.1 has ${CIS_CONTROL_COUNT}.`,
          note: 'v8 consolidated the previous 20 controls into 18 (CIS).',
        });
      }

      // The pattern only matches real 800-53 families, so what is left to catch
      // is the near-miss a reader would skim past: a control numbered zero.
      for (const { match, start, end } of doc.scan(IDENTIFIERS.nist53Control, { types: SCOPE, skipOpaque: false })) {
        if (!NIST_53_FAMILIES.has(match[1]) || Number(match[2]) > 0) continue;
        findings.push({
          start,
          end,
          message: `"${match[0]}" is not a NIST SP 800-53 control; numbering starts at 1.`,
          note: 'Control identifiers are family-number, such as AC-2 (NIST SP 800-53 Rev 5).',
        });
      }

      return findings;
    },
  },
];

function normaliseSeverity(word) {
  const w = word.toLowerCase();
  if (w === 'moderate') return 'Medium';
  if (w === 'info' || w === 'informational') return null;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function nearestScaleValue(label, scale) {
  const map = {
    severe: 'Critical', extreme: 'Critical', catastrophic: 'Critical', urgent: 'Critical',
    serious: 'High', major: 'High', substantial: 'High', elevated: 'High',
    moderate: 'Medium', significant: 'Medium',
    minor: 'Low', negligible: 'Low', trivial: 'Low',
  };
  const guess = map[label.toLowerCase().replace(/^very\s+/, '')];
  return guess && scale.includes(guess) ? guess : `one of: ${scale.join(', ')}`;
}

function nearestHeadingBefore(headings, block) {
  let found = null;
  for (const heading of headings) {
    if (heading.start < block.start) found = heading;
    else break;
  }
  return found;
}

function truncate(value, length = 60) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
