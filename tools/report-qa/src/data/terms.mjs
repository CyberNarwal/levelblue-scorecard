/**
 * Security-domain terminology: canonical spellings, acronym expansions and the
 * identifier formats that show up in advisory reports.
 *
 * Getting a vendor or standard's name wrong is the fastest way for a reader to
 * decide the report was not checked, so these are treated as real findings
 * rather than nits.
 */

/**
 * Canonical forms.
 *
 * `wrong` must match ONLY incorrect spellings - never the canonical form. The
 * rule also compares each match against `right` and drops exact hits, but that
 * is a safety net, not the mechanism. Keep patterns tight: a loose one fires on
 * every page and trains the reviewer to ignore the tool.
 *
 * `severity` defaults to 'minor'. `note` explains the why, which matters when
 * the "wrong" form is merely outdated rather than incorrect.
 */
export const CANONICAL_TERMS = [
  // Standards and frameworks
  { wrong: /\bNIST\s+Cybersecurity\s+Framework\s+v?2(?:\.0)?\b/i, right: 'NIST CSF 2.0' },
  { wrong: /\bNIST\s+CSF\s+v2(?:\.0)?\b/i, right: 'NIST CSF 2.0' },
  { wrong: /\bISO[\s-]?27001\b/, right: 'ISO/IEC 27001', note: 'The standard is jointly published, so the formal citation is ISO/IEC 27001.' },
  { wrong: /\bISO[\s-]?27002\b/, right: 'ISO/IEC 27002' },
  { wrong: /\bISO\/IEC\s?27001[:\s]?2013\b/, right: 'ISO/IEC 27001:2022', severity: 'major', note: 'ISO/IEC 27001:2013 is withdrawn and the transition window has closed. Confirm this is a deliberate historical reference.' },
  { wrong: /\bPCI[-_]DSS\b|\bPCIDSS\b|\bPCI\s+dss\b/, right: 'PCI DSS' },
  { wrong: /\bCIS\s+controls\b/, right: 'CIS Controls' },
  { wrong: /\bcyber\s?essentials(?:\s+plus)?\b(?<!Cyber Essentials)(?<!Cyber Essentials Plus)/, right: 'Cyber Essentials / Cyber Essentials Plus' },
  { wrong: /\bGDPR\s+regulation\b/i, right: 'GDPR', note: 'Redundant - the R already stands for Regulation.' },
  { wrong: /\bNIS\s?2\s+directive\s+regulation\b/i, right: 'NIS2 Directive' },
  { wrong: /\bSOC\s?2\b(?<!SOC 2)/, right: 'SOC 2' },
  { wrong: /\bMITRE\s+ATT&?CK\b(?<!MITRE ATT&CK)|\bMitre\s+Att&?ck\b|\bmitre\s+att&?ck\b/, right: 'MITRE ATT&CK' },

  // Vendors and products
  { wrong: /\bAzure\s+AD\b|\bAzure\s+Active\s+Directory\b/, right: 'Microsoft Entra ID', note: 'Renamed in 2023. Use the current name unless quoting a historical document.' },
  { wrong: /\bO365\b/, right: 'Microsoft 365' },
  { wrong: /\bOffice\s?365\b/, right: 'Microsoft 365', note: 'Office 365 branding was retired for most SKUs.' },
  { wrong: /\bcrowdstrike\b|\bCrowdstrike\b|\bCrowd\s+Strike\b/, right: 'CrowdStrike' },
  { wrong: /\bsentinelone\b|\bSentinel\s?One\b(?<!SentinelOne)/, right: 'SentinelOne' },
  { wrong: /\bpaloalto\b|\bpalo\s+alto\b/, right: 'Palo Alto Networks' },
  { wrong: /\bfortinet\b/, right: 'Fortinet' },
  { wrong: /\bactive\s+directory\b|\bActive\s+directory\b/, right: 'Active Directory' },
  { wrong: /\bWindows\s+Defender\b|\bwindows\s+defender\b/, right: 'Microsoft Defender', note: 'Windows Defender is the legacy name; the product family is Microsoft Defender.' },
  { wrong: /\bsplunk\b/, right: 'Splunk' },
  { wrong: /\bkerberoasting\b/, right: 'Kerberoasting' },
  { wrong: /\blog4j\b|\bLog4J\b|\bLOG4J\b/, right: 'Log4j' },
  { wrong: /\blog4shell\b|\bLog4shell\b/, right: 'Log4Shell' },

  // House-style spellings
  { wrong: /\be-mail(?:s|ed|ing)?\b|\bE-mail(?:s|ed|ing)?\b/, right: 'email', note: 'Modern style drops the hyphen.' },
  { wrong: /\bwifi\b|\bWiFi\b|\bWIFI\b|\bWi\s+Fi\b|\bwi-fi\b/, right: 'Wi-Fi' },
  { wrong: /\bweb\s+site(?:s)?\b/i, right: 'website' },
  { wrong: /\bon-?premise\b(?!s)/i, right: 'on-premises', note: '"On-premise" means "based on a proposition"; the infrastructure term is "on-premises".' },
  { wrong: /\bon-going\b/i, right: 'ongoing', note: 'LevelBlue house style: "ongoing" is a noun and adjective; "on-going" is non-standard.' },
  { wrong: /\bLevel\s+Blue\b/, right: 'LevelBlue', note: 'Company name is one word: LevelBlue.' },
  { wrong: /\bmulti\s+factor\s+authentication\b|\bmultifactor\s+authentication\b/i, right: 'multi-factor authentication' },
  { wrong: /\bzero\s+day\s+(?=vulnerabilit|exploit|attack|threat)/i, right: 'zero-day ', note: 'Hyphenate when used attributively.' },
  { wrong: /\bman\s+in\s+the\s+middle\b/i, right: 'adversary-in-the-middle', note: 'Hyphenate, and prefer the neutral form used by MITRE ATT&CK and NCSC.' },
  { wrong: /\bcyber-security\b/i, right: 'cyber security (UK) or cybersecurity (US)', note: 'The hyphenated form is non-standard in both dialects.' },
  { wrong: /\bInternet\b(?=\s(?:connection|access|facing|traffic|service))/, right: 'internet', note: 'Lower case in current British and American style guides.' },
  { wrong: /\bSSL\b(?!\/TLS)(?!\s*\/\s*TLS)(?!\s+certificate)/, right: 'TLS', severity: 'major', note: 'All SSL versions are deprecated and disallowed by PCI DSS. Use TLS unless deliberately naming the historical protocol.' },
  { wrong: /\bwhitelist(?:ed|ing|s)?\b/i, right: 'allowlist', note: 'NCSC and CISA both recommend allowlist/blocklist.' },
  { wrong: /\bblacklist(?:ed|ing|s)?\b/i, right: 'blocklist', note: 'NCSC and CISA both recommend allowlist/blocklist.' },
  { wrong: /\bpen\s?test(?:s|ing|ed)?\b/i, right: 'penetration test', note: 'Spell it out in a client-facing report.' },
  { wrong: /\bhackers?\b/i, right: 'threat actor / attacker', note: 'Prefer precise, neutral terminology in advisory writing.' },
];

/**
 * Acronyms an advisory report may use without expansion, because the audience
 * is assumed to know them. Everything else should be expanded on first use.
 */
export const COMMON_ACRONYMS = new Set([
  // General business and office vocabulary
  'IT', 'OT', 'HR', 'CEO', 'CTO', 'CFO', 'COO', 'CIO', 'CISO', 'UK', 'US',
  'USA', 'EU', 'OK', 'RAG', 'KPI', 'KRI', 'SLA', 'VIP', 'TBC', 'TBD', 'NA',
  'FTE', 'ROI', 'VAT', 'PM', 'AM', 'GMT', 'UTC', 'BST', 'QA', 'FAQ', 'AI',
  // Ubiquitous technology
  'PC', 'USB', 'PDF', 'CSV', 'URL', 'URI', 'ID', 'IP', 'API', 'OS', 'CPU',
  'RAM', 'SQL', 'HTML', 'XML', 'JSON', 'HTTP', 'HTTPS', 'SSH', 'FTP', 'SFTP',
  'DNS', 'DHCP', 'SMB', 'RDP', 'LDAP', 'SMTP', 'TCP', 'UDP', 'VPN', 'WAN',
  'LAN', 'WLAN', 'VLAN', 'NAT', 'SSL', 'TLS', 'CPU', 'SAN', 'NAS', 'VM',
  'SAAS', 'IAAS', 'PAAS', 'AWS', 'GCP', 'CDN', 'MDM', 'AD',
  // Standards bodies and frameworks whose initials function as proper nouns
  'NIST', 'ISO', 'IEC', 'MITRE', 'CIS', 'PCI', 'DSS', 'OWASP', 'SANS', 'ENISA',
  'ETSI', 'IETF', 'RFC', 'CSA', 'FCA', 'HMRC', 'NHS', 'MOD',
]);

/** Expansions used to check that a first-use expansion is the right one. */
export const ACRONYM_EXPANSIONS = {
  MFA: 'multi-factor authentication',
  SSO: 'single sign-on',
  EDR: 'endpoint detection and response',
  XDR: 'extended detection and response',
  MDR: 'managed detection and response',
  SIEM: 'security information and event management',
  SOAR: 'security orchestration, automation and response',
  SOC: 'security operations centre',
  IAM: 'identity and access management',
  PAM: 'privileged access management',
  DLP: 'data loss prevention',
  CASB: 'cloud access security broker',
  ZTNA: 'zero trust network access',
  SASE: 'secure access service edge',
  CSF: 'Cybersecurity Framework',
  CIS: 'Center for Internet Security',
  CVE: 'Common Vulnerabilities and Exposures',
  CVSS: 'Common Vulnerability Scoring System',
  IOC: 'indicator of compromise',
  TTP: 'tactics, techniques and procedures',
  RPO: 'recovery point objective',
  RTO: 'recovery time objective',
  BCP: 'business continuity plan',
  DRP: 'disaster recovery plan',
  IR: 'incident response',
  BYOD: 'bring your own device',
  PII: 'personally identifiable information',
  MTTD: 'mean time to detect',
  MTTR: 'mean time to respond',
  NCSC: 'National Cyber Security Centre',
  CISA: 'Cybersecurity and Infrastructure Security Agency',
  ICO: "Information Commissioner's Office",
  GDPR: 'General Data Protection Regulation',
  DORA: 'Digital Operational Resilience Act',
  VDP: 'vulnerability disclosure programme',
  RBAC: 'role-based access control',
  SBOM: 'software bill of materials',
};

/** Identifier formats seen in vulnerability and threat reporting. */
export const IDENTIFIERS = {
  cve: /\bCVE[-‐-― ]?(\d{4})[-‐-― ]?(\d{4,7})\b/gi,
  cweId: /\bCWE[-‐-― ]?(\d{1,4})\b/gi,
  attackTechnique: /\bT(\d{4})(?:\.(\d{3}))?\b/g,
  csfSubcategory: /\b(GV|ID|PR|DE|RS|RC)\.([A-Z]{2})[-‐-―](\d{2})\b/g,
  csfFunction: /\b(GOVERN|IDENTIFY|PROTECT|DETECT|RESPOND|RECOVER)\b/g,
  isoControl: /\bA\.(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?\b/g,
  cisControl: /\bCIS\s+Control\s+(\d{1,2})(?:\.(\d{1,2}))?\b/gi,
};

/** NIST CSF 2.0 functions, for validating subcategory prefixes. */
export const CSF_FUNCTIONS = {
  GV: 'GOVERN', ID: 'IDENTIFY', PR: 'PROTECT', DE: 'DETECT', RS: 'RESPOND', RC: 'RECOVER',
};

/** CVSS v3.1/v4.0 qualitative severity bands. */
export const CVSS_BANDS = [
  { name: 'None', min: 0.0, max: 0.0 },
  { name: 'Low', min: 0.1, max: 3.9 },
  { name: 'Medium', min: 4.0, max: 6.9 },
  { name: 'High', min: 7.0, max: 8.9 },
  { name: 'Critical', min: 9.0, max: 10.0 },
];

export function cvssBandFor(score) {
  return CVSS_BANDS.find((band) => score >= band.min && score <= band.max) || null;
}

/** Patterns for credentials and secrets that must never ship in a report. */
export const SECRET_PATTERNS = [
  { id: 'aws-access-key', label: 'AWS access key ID', pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g },
  { id: 'aws-secret-key', label: 'possible AWS secret access key', pattern: /\baws_secret_access_key\s*[=:]\s*\S{20,}/gi },
  { id: 'private-key', label: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g },
  { id: 'github-token', label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { id: 'slack-token', label: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'google-api-key', label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'jwt', label: 'JSON Web Token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { id: 'azure-secret', label: 'possible Azure client secret', pattern: /\b(?:client_secret|clientSecret)\s*[=:]\s*\S{16,}/gi },
  { id: 'connection-string', label: 'connection string with credentials', pattern: /\b[a-z]{2,12}:\/\/[^\s:@/]+:[^\s:@/]+@[^\s/]+/gi },
  { id: 'inline-password', label: 'password written in the text', pattern: /\b(?:password|passwd|pwd|passphrase)\s*(?:is|=|:)\s*["']?[^\s"',.)]{6,}/gi },
  { id: 'ntlm-hash', label: 'possible NTLM hash', pattern: /\b[a-f0-9]{32}:[a-f0-9]{32}\b/gi },
];

/** RFC 1918 / documentation ranges are fine to publish; anything else may be a live IoC. */
export const PRIVATE_IP = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.|255\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/;

/** Text that shows a draft is unfinished. */
export const PLACEHOLDERS = [
  { pattern: /\bTBC\b|\bTBD\b|\bTBA\b/g, label: 'unresolved placeholder' },
  { pattern: /\bXXX+\b/g, label: 'placeholder marker' },
  { pattern: /\bFIXME\b|\bTODO\b|\bNOTE TO SELF\b/gi, label: 'author note' },
  { pattern: /\bLorem ipsum\b/gi, label: 'Lorem ipsum filler' },
  { pattern: /\[(?:insert|client|customer|company|name|date|logo|placeholder)[^\]]{0,40}\]/gi, label: 'unfilled template field' },
  { pattern: /<(?:insert|client|customer|company|name|date)[^>]{0,40}>/gi, label: 'unfilled template field' },
  { pattern: /\{\{[^}]{1,60}\}\}/g, label: 'unrendered template variable' },
  { pattern: /\b(?:CLIENT NAME|COMPANY NAME|CLIENT_NAME)\b/g, label: 'unfilled template field' },
  { pattern: /\.{2,}\s*$/gm, label: 'trailing ellipsis - unfinished sentence', severity: 'minor' },
  { pattern: /\?{2,}|\bcheck this\b|\bconfirm\?/gi, label: 'unresolved author query' },
];
