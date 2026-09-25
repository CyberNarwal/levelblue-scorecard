/**
 * Confidentiality and release-readiness.
 *
 * Everything here is about what must not leave the building: credentials pasted
 * into a finding, another client's name surviving from the template the draft
 * was built from, internal-only markings in a document headed for the client,
 * and the editorial residue Word carries invisibly (tracked changes, comments,
 * reviewer highlighting).
 *
 * These rules are deliberately loud. A false positive costs a reviewer ten
 * seconds; a miss costs a client relationship.
 */

import { SECRET_PATTERNS } from '../data/terms.mjs';
import { escapeRegExp } from '../text.mjs';

// Speaker notes are included deliberately: they ship inside the file and are
// exactly where internal remarks and credentials end up.
const SCOPE = ['paragraph', 'listItem', 'heading', 'caption', 'tableRow', 'code', 'notes'];

export const rules = [
  {
    id: 'confidentiality/secret',
    title: 'Credential or secret in the document',
    category: 'Confidentiality',
    severity: 'blocker',
    check(doc) {
      const findings = [];
      for (const entry of SECRET_PATTERNS) {
        for (const { start, end } of doc.scan(entry.pattern, { types: SCOPE, skipOpaque: false })) {
          findings.push({
            start,
            end,
            message: `Possible ${entry.label} left in the draft.`,
            note: 'Remove it, and treat the credential as compromised: rotate it regardless of whether the report shipped.',
            redact: true,
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'confidentiality/wrong-client',
    title: "Another client's name appears in the draft",
    category: 'Confidentiality',
    severity: 'blocker',
    check(doc, ctx) {
      const forbidden = ctx.config.forbiddenClientNames || [];
      if (!forbidden.length) return [];
      const findings = [];
      for (const name of forbidden) {
        const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
        for (const { match, start, end } of doc.scan(pattern, { types: SCOPE, skipOpaque: false })) {
          findings.push({
            start,
            end,
            message: `"${match[0]}" appears in this draft but is not the engagement client.`,
            note: 'Almost always template leakage from the report this draft was copied from.',
          });
        }
      }
      return findings;
    },
  },

  {
    id: 'confidentiality/client-name-missing',
    title: 'Engagement client is never named',
    category: 'Completeness',
    severity: 'major',
    check(doc, ctx) {
      const client = ctx.config.client?.name;
      if (!client) return [];
      const aliases = [client, ...(ctx.config.client.aliases || [])];
      const found = aliases.some((alias) => new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i').test(doc.text));
      if (found) return [];
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: `The configured client "${client}" is never named in the draft. Check the template fields were filled in.`,
        documentLevel: true,
      }];
    },
  },

  {
    id: 'confidentiality/classification-marking',
    title: 'Classification marking is missing or inconsistent',
    category: 'Confidentiality',
    severity: 'major',
    check(doc, ctx) {
      const expected = ctx.config.classification;
      if (!expected) return [];
      const pattern = new RegExp(`\\b${escapeRegExp(expected)}\\b`, 'i');
      const inBody = pattern.test(doc.text);
      const inHeaderFooter = (doc.meta.headerFooterText || []).some((t) => pattern.test(t));
      if (inBody || inHeaderFooter) {
        // Check no competing marking is also present.
        const others = ['public', 'internal only', 'internal use only', 'restricted', 'confidential', 'secret', 'official sensitive']
          .filter((label) => label.toLowerCase() !== expected.toLowerCase())
          .filter((label) => new RegExp(`\\b${escapeRegExp(label)}\\b`, 'i').test(doc.text));
        if (!others.length) return [];
        return [{
          start: 0,
          end: Math.min(1, doc.text.length),
          message: `The draft is marked "${expected}" but also carries: ${others.join(', ')}. Two classifications on one document is an audit finding.`,
          documentLevel: true,
        }];
      }
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: `No "${expected}" classification marking found in the body, headers or footers.`,
        note: doc.format === 'docx' ? undefined : 'Headers and footers are only readable in .docx sources.',
        documentLevel: true,
      }];
    },
  },

  {
    id: 'confidentiality/internal-marking',
    title: 'Internal-only content in a client deliverable',
    category: 'Confidentiality',
    severity: 'blocker',
    check(doc, ctx) {
      if (ctx.config.audience !== 'client') return [];
      const findings = [];
      const pattern = /\b(?:internal use only|internal only|do not distribute|not for (?:client|external) (?:distribution|release)|draft - not for issue|for internal review|delivery team only|margin|day rate|chargeable|upsell|cross-sell|commercially sensitive)\b/gi;
      // Speaker notes are left to slides/internal-content-in-notes, which can
      // name the slide and explain that notes ship inside the file.
      const scope = SCOPE.filter((type) => type !== 'notes');
      for (const { match, start, end } of doc.scan(pattern, { types: scope, skipOpaque: false })) {
        findings.push({
          start,
          end,
          message: `"${match[0]}" in a document whose configured audience is the client.`,
        });
      }
      return findings;
    },
  },

  {
    id: 'confidentiality/tracked-changes',
    title: 'Unaccepted tracked changes',
    category: 'Release readiness',
    severity: 'blocker',
    check(doc) {
      const { trackedInsertions = 0, trackedDeletions = 0, trackedChangeLines = [] } = doc.meta;
      if (!trackedInsertions && !trackedDeletions) return [];
      const parts = [];
      if (trackedInsertions) parts.push(`${trackedInsertions} insertion${trackedInsertions === 1 ? '' : 's'}`);
      if (trackedDeletions) parts.push(`${trackedDeletions} deletion${trackedDeletions === 1 ? '' : 's'}`);
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: `The document still contains tracked changes (${parts.join(', ')}), first at paragraph ${trackedChangeLines[0]}.`,
        note: 'Accept or reject all changes before issue - a recipient can read the edit history, including what was removed.',
        documentLevel: true,
      }];
    },
  },

  {
    id: 'confidentiality/unresolved-comments',
    title: 'Unresolved reviewer comments',
    category: 'Release readiness',
    severity: 'blocker',
    check(doc) {
      // Decks are covered by slides/comments, which can name the slide.
      if (doc.format === 'pptx') return [];
      const comments = doc.meta.comments || [];
      if (!comments.length) return [];
      const preview = comments.slice(0, 3)
        .map((c) => `${c.author || 'unknown'}: "${truncate(c.text, 70)}"`)
        .join(' | ');
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: `${comments.length} reviewer comment${comments.length === 1 ? '' : 's'} still in the document. ${preview}${comments.length > 3 ? ' ...' : ''}`,
        note: 'Comments travel with the .docx and are visible to anyone who opens it.',
        documentLevel: true,
      }];
    },
  },

  {
    id: 'confidentiality/leftover-highlighting',
    title: 'Reviewer highlighting left in the text',
    category: 'Release readiness',
    severity: 'major',
    check(doc) {
      const highlights = doc.meta.highlights || [];
      if (!highlights.length) return [];
      const colours = [...new Set(highlights.map((h) => h.colour))];
      return [{
        start: 0,
        end: Math.min(1, doc.text.length),
        message: `${highlights.length} highlighted passage${highlights.length === 1 ? '' : 's'} (${colours.join(', ')}), first at paragraph ${highlights[0].line}.`,
        note: 'Highlighting is normally a note-to-self that should be cleared before issue.',
        documentLevel: true,
      }];
    },
  },

  {
    id: 'confidentiality/document-metadata',
    title: 'Document metadata reveals the author or template origin',
    category: 'Confidentiality',
    severity: 'minor',
    check(doc, ctx) {
      const findings = [];
      const meta = doc.meta;
      // A deck carries the same properties a document does, and the field that
      // leaks most often is the author - the last person to save the file it
      // was copied from. Reading only a .docx, and only its title, left the
      // most likely leak of all unchecked.
      if (!meta || (doc.format !== 'docx' && doc.format !== 'pptx')) return findings;

      const forbidden = ctx.config.forbiddenClientNames || [];
      const FIELDS = ['title', 'subject', 'category', 'keywords', 'author', 'lastModifiedBy'];
      for (const field of FIELDS) {
        const value = meta[field];
        if (!value) continue;
        const leak = forbidden.find((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(value));
        if (leak) {
          findings.push({
            start: 0,
            end: Math.min(1, doc.text.length),
            message: `Document property "${field}" still reads "${value}" - it names ${leak}, not this engagement.`,
            note: 'File properties travel with the file. In PowerPoint: File, Info, Properties.',
            severity: 'blocker',
            documentLevel: true,
          });
        }
      }
      if (meta.revision && Number(meta.revision) === 1 && meta.author) {
        findings.push({
          start: 0,
          end: Math.min(1, doc.text.length),
          message: `Document shows revision 1 by "${meta.author}" - confirm this is the intended draft and not an unsaved copy.`,
          severity: 'nit',
          documentLevel: true,
        });
      }
      return findings;
    },
  },

  {
    id: 'confidentiality/personal-data',
    title: 'Personal data in the report body',
    category: 'Confidentiality',
    severity: 'major',
    check(doc, ctx) {
      if (!ctx.config.flagPersonalData) return [];
      const findings = [];
      const patterns = [
        { label: 'email address', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g },
        { label: 'UK National Insurance number', pattern: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g },
        { label: 'payment card number', pattern: /\b(?:\d[ -]?){13,16}\d\b/g },
        { label: 'telephone number', pattern: /\b(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}\b/g },
      ];
      for (const entry of patterns) {
        for (const { match, start, end } of doc.scan(entry.pattern, { types: SCOPE, skipOpaque: false })) {
          if (entry.label === 'email address' && isGenericAddress(match[0])) continue;
          if (entry.label === 'payment card number' && !luhn(match[0])) continue;
          findings.push({
            start,
            end,
            message: `Possible ${entry.label} in the report body.`,
            note: 'Confirm this belongs in the deliverable, or pseudonymise it.',
            redact: entry.label !== 'email address',
          });
        }
      }
      return findings;
    },
  },
];

/** Role addresses are routine in a report; named individuals are the concern. */
function isGenericAddress(address) {
  return /^(?:info|contact|security|soc|support|admin|hello|enquiries|noreply|no-reply|abuse|privacy|dpo)@/i.test(address);
}

function luhn(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
