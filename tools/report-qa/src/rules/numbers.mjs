/**
 * Numbers, units and internal data consistency.
 *
 * The highest-value check here is `numbers/contradictory-statistic`: an
 * executive summary that says "12 critical findings" while the findings table
 * lists 14 is the kind of error that gets a report sent back, and it is exactly
 * the kind a human proofreader misses.
 */

const SCOPE = ['paragraph', 'listItem', 'heading', 'caption', 'tableRow'];

const UNITS = 'GB|MB|TB|KB|PB|Gbps|Mbps|Kbps|GHz|MHz|ms|kg|km|cm|mm|hrs?|hours?|mins?|minutes?|days?|weeks?|months?|years?|%';

export const rules = [
  {
    id: 'numbers/unit-spacing',
    title: 'Inconsistent spacing between number and unit',
    category: 'Numbers',
    severity: 'nit',
    check(doc) {
      const spaced = [...doc.scan(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s(?:${UNITS})\\b`, 'g'), { types: SCOPE })];
      const closed = [...doc.scan(new RegExp(`\\b\\d+(?:\\.\\d+)?(?:${UNITS})\\b`, 'g'), { types: SCOPE })];
      // Percentages follow their own convention, so judge them separately.
      const groups = [
        ['%', spaced.filter((h) => h.match[0].endsWith('%')), closed.filter((h) => h.match[0].endsWith('%'))],
        ['unit', spaced.filter((h) => !h.match[0].endsWith('%')), closed.filter((h) => !h.match[0].endsWith('%'))],
      ];
      const findings = [];
      for (const [kind, withSpace, withoutSpace] of groups) {
        if (!withSpace.length || !withoutSpace.length) continue;
        const offenders = withSpace.length >= withoutSpace.length ? withoutSpace : withSpace;
        findings.push({
          start: offenders[0].start,
          end: offenders[0].end,
          message: kind === '%'
            ? `Percentages are written both as "50%" (${withoutSpace.length}) and "50 %" (${withSpace.length}). Pick one - "50%" is conventional.`
            : `Units are written both as "10 GB" (${withSpace.length}) and "10GB" (${withoutSpace.length}). Pick one - a non-breaking space before the unit is conventional.`,
          aggregate: true,
          occurrences: offenders.length,
        });
      }
      return findings;
    },
  },

  {
    id: 'numbers/numeral-style',
    title: 'Inconsistent numeral style',
    category: 'Numbers',
    severity: 'nit',
    check(doc, ctx) {
      if (!ctx.config.houseStyle.spellOutNumbersBelowTen) return [];
      const findings = [];
      // A bare digit under ten, not part of a measurement, version or identifier.
      for (const { match, start, end, block } of doc.scan(/(?<![\d.\-/])\b([1-9])\b(?![\d.\-/%])/g, { types: ['paragraph', 'listItem'] })) {
        const after = block.text.slice(match.index + match[0].length, match.index + match[0].length + 24);
        if (new RegExp(`^\\s*(?:${UNITS})\\b`).test(after)) continue;
        if (/^\s*(?:\)|\.|,\s*\d)/.test(after)) continue;
        if (!/^\s+[a-z]/.test(after)) continue;
        findings.push({
          start,
          end,
          message: `House style spells out numbers below ten: "${numberWord(Number(match[1]))}" rather than "${match[1]}".`,
          suggestion: numberWord(Number(match[1])),
        });
      }
      return findings;
    },
  },

  {
    id: 'numbers/redundant-numeral',
    title: 'Number written twice',
    category: 'Numbers',
    severity: 'minor',
    fixable: true,
    check(doc) {
      const findings = [];
      const words = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
      for (const { match, start, end } of doc.scan(new RegExp(`\\b(${words})\\s*\\((\\d{1,2})\\)`, 'gi'), { types: SCOPE })) {
        findings.push({
          start,
          end,
          message: `"${match[0]}" repeats the number. The legal-contract convention does not belong in an advisory report.`,
          suggestion: match[1],
          fix: match[1],
        });
      }
      return findings;
    },
  },

  {
    id: 'numbers/contradictory-statistic',
    title: 'The same statistic is given two different values',
    category: 'Data integrity',
    severity: 'blocker',
    check(doc) {
      const stats = new Map();
      const pattern = /\b(\d{1,4})\s+((?:critical|high|medium|low|informational|open|closed|total|outstanding)\s+)?(findings?|issues?|risks?|vulnerabilit(?:y|ies)|recommendations?|controls?|gaps?|observations?)\b/gi;
      for (const { match, start, end } of doc.scan(pattern, { types: SCOPE })) {
        const qualifier = (match[2] || '').trim().toLowerCase();
        const noun = normalisePlural(match[3].toLowerCase());
        const key = `${qualifier} ${noun}`.trim();
        const value = Number(match[1]);
        if (!stats.has(key)) stats.set(key, []);
        stats.get(key).push({ value, start, end, text: match[0] });
      }

      const findings = [];
      for (const [key, hits] of stats) {
        const values = [...new Set(hits.map((h) => h.value))];
        if (values.length < 2) continue;
        const lines = hits.map((h) => `"${h.text}" (line ${doc.position(h.start).line})`);
        findings.push({
          start: hits[0].start,
          end: hits[0].end,
          message: `"${key}" is given as ${values.join(' and ')} in different places: ${lines.join(', ')}.`,
          note: 'One of these is wrong, or they are counting different things and need to say so.',
          aggregate: true,
          occurrences: hits.length,
        });
      }
      return findings;
    },
  },

  {
    id: 'numbers/percentage-total',
    title: 'Percentages do not add up',
    category: 'Data integrity',
    severity: 'major',
    check(doc) {
      const findings = [];
      // A breakdown stated inline: "45% critical, 30% high and 20% medium".
      for (const sentence of doc.sentences()) {
        const percentages = [...sentence.text.matchAll(/(\d{1,3}(?:\.\d)?)\s?%/g)].map((m) => Number(m[1]));
        if (percentages.length < 3) continue;
        if (!/\b(?:breakdown|split|comprised|consist|made up|distribution|of which|respectively)\b/i.test(sentence.text)) continue;
        const total = percentages.reduce((a, b) => a + b, 0);
        if (Math.abs(total - 100) <= 1.5) continue;
        findings.push({
          start: sentence.start,
          end: sentence.end,
          message: `This looks like a breakdown, but the percentages total ${round(total)}%, not 100%.`,
          note: 'Rounding can account for a point or so; this is further out than that.',
          confidence: 'medium',
        });
      }
      return findings;
    },
  },

  {
    id: 'numbers/currency-consistency',
    title: 'Inconsistent currency formatting',
    category: 'Numbers',
    severity: 'nit',
    check(doc) {
      const abbreviated = [...doc.scan(/[£$€]\s?\d+(?:\.\d+)?\s?(?:k|m|bn|K|M|BN)\b/g, { types: SCOPE })];
      const full = [...doc.scan(/[£$€]\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b/g, { types: SCOPE })];
      if (!abbreviated.length || !full.length) return [];
      const offenders = abbreviated.length >= full.length ? full : abbreviated;
      return [{
        start: offenders[0].start,
        end: offenders[0].end,
        message: `Currency is written both abbreviated (${abbreviated.length}, e.g. "${abbreviated[0].match[0]}") and in full (${full.length}, e.g. "${full[0].match[0]}"). Pick one.`,
        aggregate: true,
        occurrences: offenders.length,
      }];
    },
  },

  {
    id: 'numbers/large-number-separator',
    title: 'Large number without a thousands separator',
    category: 'Numbers',
    severity: 'nit',
    check(doc) {
      // The 5-digit floor already excludes years; ports and identifiers are
      // filtered by the surrounding punctuation guards in the pattern.
      const findings = [];
      for (const { match, start, end, block } of doc.scan(/(?<![\d,.\-/])\d{5,}(?![\d,.\-/])/g, { types: ['paragraph', 'listItem', 'tableRow'] })) {
        const value = match[0];
        // Standard numbers, ports, ticket refs and build IDs are not quantities.
        // Only flag a figure that is actually counting something.
        const window = block.text.slice(Math.max(0, match.index - 40), match.index + value.length + 40);
        if (!COUNTING_CONTEXT.test(window)) continue;
        findings.push({
          start,
          end,
          message: `"${value}" would read more easily as "${Number(value).toLocaleString('en-GB')}".`,
          suggestion: Number(value).toLocaleString('en-GB'),
          confidence: 'low',
        });
      }
      return findings;
    },
  },

  {
    id: 'numbers/future-date-past-tense',
    title: 'Past-tense statement with a future date',
    category: 'Data integrity',
    severity: 'major',
    check(doc, ctx) {
      const findings = [];
      const now = ctx.now;
      const pattern = /\b(\d{1,2})?\s?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
      for (const { match, start, end, block } of doc.scan(pattern, { types: SCOPE })) {
        const year = Number(match[3]);
        const month = MONTHS.indexOf(match[2].toLowerCase());
        const day = match[1] ? Number(match[1]) : 1;
        const date = new Date(Date.UTC(year, month, day));
        if (Number.isNaN(date.getTime()) || date <= now) continue;
        const context = block.text.slice(Math.max(0, match.index - 140), match.index + match[0].length + 40);
        if (!/\b(?:was|were|had|did|completed|conducted|performed|observed|took place|carried out|assessed|reviewed)\b/i.test(context)) continue;
        findings.push({
          start,
          end,
          message: `"${match[0].replace(/\s+/g, ' ').trim()}" is in the future but the surrounding text is past tense.`,
          note: `Checked against ${now.toISOString().slice(0, 10)}. Override with --now=YYYY-MM-DD if the report is dated differently.`,
          confidence: 'medium',
        });
      }
      return findings;
    },
  },
];

/** Words that mark a number as a count rather than an identifier. */
const COUNTING_CONTEXT = /\b(?:users?|accounts?|records?|events?|alerts?|assets?|devices?|endpoints?|hosts?|mailboxes|messages?|rows?|files?|objects?|total|approximately|around|over|estimated)\b/i;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

function numberWord(n) {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] || String(n);
}

function normalisePlural(noun) {
  if (noun === 'vulnerability') return 'vulnerabilities';
  if (noun.endsWith('s')) return noun;
  return `${noun}s`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
