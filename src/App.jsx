import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ─── WORKSHOP QUESTIONS ──────────────────────────────────────────────────────
const WORKSHOP_QS = {

  "GV.OC": [
    "How are cybersecurity priorities connected to business strategy — is security driven by business context or handled in isolation by IT?",
    "What regulations and contractual obligations apply to you — UK GDPR, NIS2, sector-specific — and who owns that understanding?",
    "Have you mapped your most critical business processes and the systems, people and third parties they depend on?",
    "Does cyber risk reach the board regularly, or does it stay within IT?"
  ],

  "GV.RM": [
    "Are your cyber risk management objectives formally documented and signed off at a senior level, or does risk management happen reactively?",
    "When a new risk is identified, how do you decide what's acceptable to carry versus what must be fixed — is that judgement explicit and documented?",
    "Who is accountable for cyber risk — not just who manages controls, but who is answerable to the board if something goes wrong?",
    "How often is cyber risk formally reviewed — risk committee, regular reporting cadence, or mainly when something goes wrong?"
  ],

  "GV.SC": [
    "Is there a structured programme for managing supplier security risk, or is it handled case by case?",
    "Before onboarding a supplier with system or data access, what does your security assessment process look like — questionnaire, certifications, due diligence?",
    "Do your supplier contracts require minimum security controls, incident notification timelines and audit rights?",
    "How do you maintain visibility of supplier security post-onboarding — ongoing monitoring or just at contract renewal?"
  ],

  "GV.PO": [
    "Walk me through your security policy landscape — what exists, who approved it, and how staff are made aware?",
    "When were policies last reviewed — is there a defined annual cycle with a named owner, or does it happen reactively?",
    "Where business needs conflict with policy — legacy systems, access exceptions — is there a formal exception process with documented risk acceptance and an expiry date?",
    "How do you confirm staff have read and understood policies — sign-off, testing, or something else?"
  ],

  "ID.AM": [
    "How do you know what hardware is on your network — active discovery tooling or a manually maintained register — and how confident are you it's complete?",
    "How do you track software across the estate — Intune, SCCM, manual — and do you have visibility of shadow IT?",
    "Is your network topology formally documented, showing system interconnections, trust boundaries and data flows — and when was it last validated?",
    "Do you maintain a register of external systems and SaaS dependencies, including what data they handle and what access they hold?"
  ],

  "ID.RA": [
    "Are you running regular authenticated vulnerability scans covering the full scope — cloud, remote endpoints, on-premise — and how quickly are findings acted on?",
    "How do you consume threat intelligence relevant to your sector — NCSC, ISAC, commercial feeds — and does it actually change your prioritisation decisions?",
    "Walk me through your risk register — who maintains it, what does a typical entry include, and is it a live decision-making tool or a compliance document?",
    "How do you prioritise which risks get fixed first — a documented likelihood and impact methodology, or individual judgement?"
  ],

  "ID.IM": [
    "After an incident or near-miss, is there a formal post-incident review process with documented outputs and tracked actions, or a verbal debrief that doesn't translate into change?",
    "When assessment or audit findings come in, is there a structured process to turn them into a prioritised remediation plan with owners and timelines?",
    "Do you measure security programme performance with tracked KPIs — patch SLA compliance, phishing rates, vuln remediation — reported to leadership regularly?"
  ],

  "PR.AA": [
    "Walk me through your joiner-mover-leaver process — is it HR-integrated and automated, or manual? How quickly are leavers fully disabled?",
    "Where is MFA enforced — VPN, privileged accounts, cloud consoles, email — and what type: authenticator app, hardware token or SMS?",
    "How do you ensure users only hold the access they need — defined role profiles, regular access recertification, handling of accumulated permissions after role changes?",
    "How do you manage service accounts, API keys and certificates — inventoried, same provisioning discipline as user accounts, credentials rotated on a schedule?"
  ],

  "PR.AT": [
    "Is security awareness training a structured platform with tracked completion and enforced renewal, and does every joiner receive it?",
    "Do IT admins, finance teams and executives receive role-specific training beyond the standard content, given their elevated threat exposure?",
    "Do you run phishing simulations — how frequently, what are click-through rates trending, and what happens to repeat failures?",
    "When someone clicks a simulation or reports a suspicious email, is there an immediate educational response and does the data drive targeted training?"
  ],

  "PR.DS": [
    "Do you have a formal data classification scheme — Public, Internal, Confidential, Restricted — and do staff actually handle data accordingly day to day?",
    "Is sensitive data encrypted at rest — BitLocker or FileVault on endpoints, database field or volume encryption, encrypted backup media?",
    "Are legacy unencrypted protocols still in use anywhere, and is TLS enforced to a current standard across all services including internal communication?",
    "Are retention periods defined per data type, enforced through automated deletion, and is hardware disposal handled through certified secure destruction?"
  ],

  "PR.PS": [
    "When a new system is built and deployed, is it built to a defined security baseline — CIS Benchmark or equivalent — and is configuration drift monitored after deployment?",
    "Who owns patching, what tooling is used, and what are the SLAs for critical and high severity patches — how are hard-to-patch systems handled?",
    "Is there a formal change management process — CAB, impact assessment, rollback plan — and is it consistently followed including for emergency changes?"
  ],

  "DE.CM": [
    "How do you monitor network traffic for threats — IDS, IPS, NDR — and does that cover cloud as well as on-premise, including east-west internal traffic?",
    "Are you running traditional AV or an EDR solution — CrowdStrike, SentinelOne, Defender for Endpoint — and if still on AV, what's driving that decision?",
    "Where does log data go — central SIEM or on individual systems — how long is it retained, and is it searchable and tamper-protected?",
    "Do you have any UEBA capability to detect unusual account behaviour — logins at odd times, abnormal data access, authentication anomalies?"
  ],

  "DE.AE": [
    "When an alert fires, who receives it, what's the triage process, and is there a defined SLA for response by severity — or is alert volume a problem?",
    "How do you distinguish genuine alerts from noise — are baselines and thresholds defined and tuned, and how much time goes on false positives?",
    "Do you have SIEM or XDR correlation rules that chain related events together to surface lateral movement, privilege escalation or exfiltration patterns?"
  ],

  "RS.MA": [
    "Does a current IR plan exist with playbooks for realistic scenarios — ransomware, breach, account compromise — or is it a high-level document that wouldn't hold up in a crisis?",
    "Is there a defined severity classification matrix — P1 to P4 — with escalation paths, response time targets and notification obligations for each level?",
    "Are IR team members named with defined responsibilities, including backups, documented and known before an incident — or worked out on the day?",
    "Has the IR plan been tested in the last 12 months — tabletop, simulation or live incident?"
  ],

  "RS.AN": [
    "After an incident is resolved, is there a structured root cause analysis process — 5 Whys, formal PIR — with documented outputs and tracked actions, or does the team move on?",
    "Are there documented procedures for forensic evidence acquisition, chain of custody and integrity verification — both for investigation and potential legal or regulatory use?",
    "During an incident, do you cross-reference suspicious IPs, malware or TTPs against threat intel to understand actor context — and does that change how you respond?"
  ],

  "RS.CO": [
    "When a significant incident occurs, is there a documented escalation path covering the exec team, board and key business functions including out-of-hours contacts?",
    "Do you understand your regulatory notification obligations — ICO 72 hours, NIS2 — who owns it and is it embedded in the IR plan with defined triggers?",
    "Do you have pre-approved breach communication templates and a named communications lead with a clear approval chain ready to go before an incident happens?",
    "Is your IR plan aligned to your cyber insurance policy's notification requirements?"
  ],

  "RC.RP": [
    "Do critical systems have documented recovery runbooks — step-by-step, with owners, dependencies and configuration sources — stored somewhere accessible if primary systems are down?",
    "Walk me through your backup strategy — coverage, frequency, tooling, storage location — and when did you last actually restore from backup at meaningful scale?",
    "Have RTO and RPO been defined for each critical system, agreed with the business, and validated against your actual recovery capability?"
  ],

  "RC.CO": [
    "During a recovery, is there a defined process for stakeholder communications — who communicates, to whom, how often, and through what channel if primary comms are affected?",
    "Is the post-incident review a structured documented exercise with assigned actions that reach senior leadership, or an informal debrief?",
    "Can you give an example of something that changed in your security programme as a direct result of a lessons-learned review?"
  ],

  "CIS1": [
    "How do you maintain visibility of every authorised device on your network — active discovery tooling or manual register — and how confident are you it's complete and current?",
    "What happens when an unauthorised device connects — is there NAC, DHCP monitoring or scanning alerts to detect it in near real-time, and is the response process documented?",
    "How often is the asset inventory formally reconciled against the actual network, and who owns that process?"
  ],

  "CIS2": [
    "How do you maintain an accurate software inventory — Intune, SCCM, Jamf — covering installed applications, SaaS, licences and browser extensions across all platforms?",
    "How do you prevent or detect unauthorised software — application allowlisting, software restriction policies — and how broadly is that enforced?",
    "Does the software inventory include version numbers linked to vulnerability data, so you can quickly identify outdated or end-of-life software against a critical advisory?"
  ],

  "CIS3": [
    "Do you have a formal data classification scheme and do staff genuinely handle data according to it day to day, not just on paper?",
    "Is sensitive data encrypted at rest — endpoints, databases, file stores, backup media — and is TLS enforced for all data in transit including internal system communication?",
    "Are retention periods defined per data type, aligned to legal obligations, enforced through automated deletion, and is hardware disposal certified secure?"
  ],

  "CIS4": [
    "Is every new system built to a documented security baseline — CIS Benchmark, NCSC guidance or your own standard — enforced consistently, not left to individual engineers?",
    "How do you ensure default credentials are changed before any system goes into production — is there a build checklist with an explicit verification step?",
    "How do you detect configuration drift after deployment — CIS-CAT, DSC, CSPM for cloud — and is there alerting when a system deviates from its approved baseline?"
  ],

  "CIS5": [
    "Walk me through your JML process — is it HR-integrated with a defined SLA, or manual? How quickly are leavers fully disabled after their last day?",
    "Do IT admins and privileged users have separate dedicated accounts for elevated activity, distinct from their day-to-day standard account?",
    "How do you identify dormant accounts — former staff, decommissioned service accounts, shared accounts — and is detection automated or only surfaced at audit?"
  ],

  "CIS6": [
    "How is access provisioned against defined role profiles with minimum necessary permissions, and what prevents privilege creep when someone changes roles?",
    "Where is MFA enforced — VPN, RDP, cloud admin consoles, email, privileged accounts, internet-facing apps — and are there known exceptions that haven't been addressed?",
    "How regularly do line managers formally certify their team's access is still appropriate — and is access that can't be justified removed promptly?"
  ],

  "CIS7": [
    "Are vulnerability scans authenticated and covering the full scope — cloud workloads, remote endpoints, on-premise — and who reviews output and acts on it?",
    "Are there defined remediation SLAs by severity — Critical 48hrs, High 7 days — tracked and reported, and how are hard-to-patch systems handled?",
    "When was the last penetration test, what was the scope, was it CREST-accredited, and are findings tracked through to verified remediation?"
  ],

  "CIS8": [
    "What are you logging — authentication events, privileged activity, network devices, cloud management plane, key application logs — and where are the gaps?",
    "Are logs forwarded to a central SIEM or sitting on individual systems — is storage tamper-protected with write-once or append-only enforcement?",
    "How long is log data retained — is 12 months total with hot and cold tiers defined formally, or based on platform defaults?"
  ],

  "CIS9": [
    "Walk me through your email security stack — gateway filtering, attachment sandboxing, impersonation protection, and integration with Microsoft or Google native security?",
    "How do you block malicious domains and control web access — DNS filtering like Umbrella or Cloudflare Gateway, web proxy, or relying on endpoint AV post-click?",
    "Are SPF, DKIM and DMARC configured for all sending domains including subsidiaries — and is DMARC in enforcement mode with quarantine or reject policy?"
  ],

  "CIS10": [
    "Is anti-malware deployed across all endpoints, servers, mobile devices and non-Windows platforms — and are there known coverage gaps or unmanaged systems?",
    "Are you running traditional signature AV or an EDR solution — CrowdStrike, SentinelOne, Defender for Endpoint — and if still on AV, what's blocking the move to EDR?",
    "Are definition and agent updates applied automatically, and is there monitoring to identify endpoints that have fallen behind — particularly those travelling off-network?"
  ],

  "CIS11": [
    "Walk me through backup coverage — what's included, frequency, tooling, storage location — and are there gaps like SaaS data or cloud configurations not covered?",
    "Could ransomware reach your backups — is there an air-gapped or immutable copy following the 3-2-1 principle, or are backups on the same accessible network?",
    "When did you last restore from backup at meaningful scale, validate it came back within RTO, and how is that testing documented?"
  ],

  "CIS12": [
    "Are critical systems — domain controllers, finance platforms, production databases — isolated in their own network segments with controlled traffic flows, or is this largely a flat network?",
    "Is there a documented firewall rule set with business justifications for each rule, reviewed on a defined schedule — when did you last do a full rule review?",
    "How is remote access controlled — VPN with MFA, no direct RDP or SMB internet exposure, sessions logged — and is unusual access visible in your monitoring?"
  ],

  "CIS13": [
    "What capability do you have to detect threats in network traffic — IDS, IPS, NDR — covering cloud as well as on-premise, including east-west lateral movement?",
    "Where is IDS or IPS deployed, are signatures current, alerts integrated into SIEM, and is there a response process — or is it deployed but effectively unmonitored?",
    "Are DNS queries routed through a security-aware resolver blocking malicious domains and C2 infrastructure — and does that cover users working off the corporate network?"
  ],

  "CIS14": [
    "Is security awareness training a structured platform with tracked completion, enforced renewal and onboarding for every joiner — or more informal and optional?",
    "Do IT admins, finance teams and executives receive role-specific training beyond standard content, reflecting their actual threat exposure?",
    "Do you run phishing simulations, what are click-through rates trending over time, and is the data used to target training at higher-risk individuals?"
  ],

  "CIS15": [
    "Before onboarding a supplier with system or data access, is there a structured assessment — risk-tiered questionnaire, ISO 27001, Cyber Essentials — or is it mainly commercial due diligence?",
    "Do supplier contracts include minimum security controls, incident notification timelines, data handling obligations and the right to audit?",
    "Are supplier remote sessions time-limited and logged, is access periodically reviewed for continued necessity, or is supplier access persistent and largely unmonitored?"
  ],

  "CIS16": [
    "Are security requirements, threat modelling and secure code review built into development as standard — or is security largely a post-development consideration?",
    "Is SAST integrated into the CI/CD pipeline, is DAST or API testing run against deployed applications, and do externally-facing apps receive independent penetration testing?",
    "Is software composition analysis — Snyk, Dependabot or equivalent — part of the build pipeline to continuously identify vulnerable open source dependencies?"
  ],

  "CIS17": [
    "Does a current IR plan exist with scenario-specific playbooks — ransomware, breach, account compromise — updated in the last 12 months and accessible if primary systems are down?",
    "Has the IR plan been tested through a tabletop, simulation or live incident in the last year — and what changed as a result?",
    "After incidents, is there a structured PIR with documented actions tracked to closure, or an informal debrief that doesn't consistently produce lasting change?"
  ],

  "CIS18": [
    "When was the last penetration test, what was the scope — external perimeter, internal network, applications, cloud — and was it carried out by a CREST or CHECK-accredited firm?",
    "Did the test include social engineering — phishing or vishing — alongside technical testing to give a realistic picture of the attack surface?",
    "Are pentest findings logged in a tracked remediation plan with owners and target dates, with a retest conducted before Critical and High findings are closed?"
  ]
};

// ─── RECOMMENDATIONS LIBRARY ─────────────────────────────────────────────────
const RECS = {
  "GV.OC_q0": { action: "Define and document the cybersecurity mission", detail: "Run a facilitated workshop with senior leadership to agree cyber objectives that tie directly to business outcomes, and record these in a one-page mission statement.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 GV.OC-01" },
  "GV.OC_q1": { action: "Conduct a regulatory and legal obligations review", detail: "Map applicable regulations (UK GDPR, NIS2, sector-specific) to current controls and identify gaps; assign a compliance owner.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 GV.OC-02" },
  "GV.OC_q2": { action: "Identify and document critical business dependencies", detail: "Perform a Business Impact Analysis (BIA) to identify critical processes, systems and third parties, and use outputs to prioritise protection efforts.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 GV.OC-03" },
  "GV.RM_q0": { action: "Establish a formal risk management framework", detail: "Adopt a recognised framework (ISO 31000, NIST RMF) and define risk management objectives in a board-approved policy.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 GV.RM-01" },
  "GV.RM_q1": { action: "Define and document risk appetite", detail: "Engage the board to produce a written risk appetite statement that distinguishes between tolerable and intolerable risk levels across key asset classes.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 GV.RM-02" },
  "GV.RM_q2": { action: "Assign named risk management roles", detail: "Create a RACI matrix for cyber risk management covering identification, assessment, treatment and acceptance, and include these in job descriptions.", effort: "Low", priority: "Medium", ref: "NIST CSF 2.0 GV.RM-03" },
  "GV.SC_q0": { action: "Implement a supply chain risk management programme", detail: "Develop a third-party risk policy, create a supplier register, and define minimum security requirements by supplier tier.", effort: "High", priority: "High", ref: "NIST CSF 2.0 GV.SC-01" },
  "GV.SC_q1": { action: "Introduce pre-engagement supplier security assessments", detail: "Create a standard security questionnaire aligned to Cyber Essentials or equivalent and make completion mandatory before onboarding new suppliers with access to data or systems.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 GV.SC-02" },
  "GV.SC_q2": { action: "Embed security requirements in all supplier contracts", detail: "Work with legal to include standard security clauses covering data handling, incident notification timelines, audit rights and minimum control requirements.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 GV.SC-03" },
  "GV.PO_q0": { action: "Develop and ratify a cybersecurity policy suite", detail: "Produce a top-level Information Security Policy with supporting policies covering acceptable use, access control, data handling and incident response; obtain board sign-off.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 GV.PO-01" },
  "GV.PO_q1": { action: "Establish a policy review schedule", detail: "Set a minimum annual review cycle, assign policy owners for each document, and record review dates and sign-off in a policy register.", effort: "Low", priority: "Medium", ref: "NIST CSF 2.0 GV.PO-01" },
  "GV.PO_q2": { action: "Implement a formal policy exception process", detail: "Define a documented exception request and approval workflow including risk acceptance, compensating controls, expiry dates and CISO or equivalent sign-off.", effort: "Low", priority: "Medium", ref: "NIST CSF 2.0 GV.PO-01" },
  "ID.AM_q0": { action: "Implement an active hardware asset inventory", detail: "Deploy a network scanning tool (e.g. Lansweeper, Nmap scheduled scan) to auto-discover and maintain an up-to-date hardware register including asset owner and location.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 ID.AM-01 / CIS Control 1" },
  "ID.AM_q1": { action: "Establish a software asset inventory with licence tracking", detail: "Use endpoint management tooling (SCCM, Intune, or similar) to enumerate installed software, track versions and flag unauthorised applications.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 ID.AM-02 / CIS Control 2" },
  "ID.AM_q2": { action: "Document network topology and data flows", detail: "Produce and maintain a network diagram and data flow diagram showing system interconnections, trust boundaries and data classification; review quarterly.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 ID.AM-03" },
  "ID.AM_q3": { action: "Catalogue all external systems and cloud services", detail: "Create a register of all SaaS, cloud and third-party systems including data classifications handled, access methods and contractual security obligations.", effort: "Low", priority: "Medium", ref: "NIST CSF 2.0 ID.AM-05" },
  "ID.RA_q0": { action: "Implement regular vulnerability scanning", detail: "Deploy an authenticated vulnerability scanner (Tenable, Qualys or equivalent) against all in-scope assets on at minimum a monthly schedule with tracked remediation.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 ID.RA-01 / CIS Control 7" },
  "ID.RA_q1": { action: "Subscribe to and operationalise threat intelligence feeds", detail: "Onboard a threat intelligence source appropriate to sector (NCSC feeds, CISA advisories, ISAC membership) and assign responsibility for reviewing and actioning alerts.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 ID.RA-02" },
  "ID.RA_q2": { action: "Establish and maintain a risk register", detail: "Create a risk register with named owners, risk ratings, agreed treatment plans and review dates; present to senior management at least quarterly.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 ID.RA-05" },
  "ID.RA_q3": { action: "Adopt a consistent risk scoring methodology", detail: "Implement a risk matrix using likelihood and impact ratings (e.g. 5x5) and apply it consistently across all identified risks to enable objective prioritisation.", effort: "Low", priority: "Medium", ref: "NIST CSF 2.0 ID.RA-05" },
  "ID.IM_q0": { action: "Formalise post-incident lessons learned process", detail: "Mandate a post-incident review for all P1/P2 incidents and track agreed actions in the risk register or improvement log with owners and target dates.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 ID.IM-01" },
  "ID.IM_q1": { action: "Create a security improvement roadmap driven by assessments", detail: "Translate assessment findings into a prioritised improvement plan with effort, cost and owner assigned to each action; review progress monthly.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 ID.IM-02" },
  "ID.IM_q2": { action: "Define and track security KPIs and KRIs", detail: "Agree a set of measurable security metrics (e.g. mean time to patch, phishing click rate, vulnerability remediation rate) and report these to leadership on a monthly cadence.", effort: "Medium", priority: "Medium", ref: "NIST CSF 2.0 ID.IM-03" },
  "PR.AA_q0": { action: "Implement a formal identity lifecycle management process", detail: "Define joiner, mover, leaver (JML) procedures covering provisioning, access modification and timely deprovisioning; automate where possible via HR system integration.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 PR.AA-01 / CIS Control 5" },
  "PR.AA_q1": { action: "Deploy MFA across all privileged and remote access", detail: "Enforce phishing-resistant MFA (FIDO2/hardware token preferred, authenticator app as minimum) for all admin accounts, VPN and remote access.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 PR.AA-03 / CIS Control 6" },
  "PR.AA_q2": { action: "Implement least privilege and conduct regular access reviews", detail: "Remove standing privileged access in favour of Just-in-Time (JIT) where feasible; conduct quarterly access certification reviews with line managers confirming necessity.", effort: "High", priority: "Critical", ref: "NIST CSF 2.0 PR.AA-05 / CIS Control 6" },
  "PR.AA_q3": { action: "Implement a service account and non-human identity register", detail: "Inventory all service accounts, API keys and certificates; enforce password rotation, remove orphaned accounts and apply least privilege; consider a PAM solution.", effort: "High", priority: "High", ref: "NIST CSF 2.0 PR.AA-01" },
  "PR.AT_q0": { action: "Deploy a mandatory security awareness training programme", detail: "Implement a platform-based awareness programme (KnowBe4, Proofpoint Security Awareness or equivalent) with completion tracking and annual renewal for all staff.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 PR.AT-01 / CIS Control 14" },
  "PR.AT_q1": { action: "Deliver role-specific training for privileged users", detail: "Provide tailored training for IT administrators, developers and senior management covering their specific risk exposure, responsibilities and threat landscape.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 PR.AT-02" },
  "PR.AT_q2": { action: "Run regular phishing simulation exercises", detail: "Schedule quarterly phishing simulations, track click and report rates over time, and use results to target additional training for high-risk user groups.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 PR.AT-01 / CIS Control 14" },
  "PR.DS_q0": { action: "Implement a data classification scheme", detail: "Define classification tiers (e.g. Public, Internal, Confidential, Restricted), train staff on handling requirements for each tier and apply labels to documents and data stores.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 PR.DS / CIS Control 3" },
  "PR.DS_q1": { action: "Enforce encryption for sensitive data at rest", detail: "Enable full-disk encryption on all endpoints (BitLocker/FileVault), encrypt database fields containing sensitive data and encrypt backup media.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 PR.DS-01 / CIS Control 3" },
  "PR.DS_q2": { action: "Enforce TLS for all data in transit", detail: "Audit all internal and external communications for unencrypted protocols; enforce TLS 1.2 minimum (TLS 1.3 preferred) and disable legacy protocols.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 PR.DS-02 / CIS Control 3" },
  "PR.DS_q3": { action: "Establish data retention and secure disposal procedures", detail: "Define retention periods by data classification and regulatory requirement, implement automated deletion where possible and use certified secure disposal for physical media.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 PR.DS / CIS Control 3" },
  "PR.PS_q0": { action: "Implement security configuration baselines", detail: "Adopt CIS Benchmarks or vendor security baselines for all operating systems and applications; enforce through Group Policy, MDM or configuration management tooling.", effort: "High", priority: "Critical", ref: "NIST CSF 2.0 PR.PS-01 / CIS Control 4" },
  "PR.PS_q1": { action: "Implement a risk-based patch management programme", detail: "Define patching SLAs by severity (e.g. Critical: 48hrs, High: 7 days, Medium: 30 days), automate deployment where possible and track compliance via vulnerability scanner.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 PR.PS-02 / CIS Control 7" },
  "PR.PS_q2": { action: "Implement formal change management controls", detail: "Enforce a change advisory board (CAB) or equivalent process for production changes, requiring impact assessment, rollback plan and approval before implementation.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 PR.PS-03" },
  "DE.CM_q0": { action: "Deploy network traffic monitoring and anomaly detection", detail: "Implement IDS/IPS or NDR tooling at network ingress/egress points; configure alerting for anomalous traffic patterns and known malicious indicators.", effort: "High", priority: "High", ref: "NIST CSF 2.0 DE.CM-01 / CIS Control 13" },
  "DE.CM_q1": { action: "Deploy Endpoint Detection and Response (EDR)", detail: "Replace legacy AV with an EDR solution (CrowdStrike, SentinelOne, Microsoft Defender for Endpoint) across all endpoints to enable behavioural detection and response capability.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 DE.CM-09 / CIS Control 10" },
  "DE.CM_q2": { action: "Implement centralised log collection and SIEM", detail: "Aggregate logs from endpoints, network devices, identity systems and cloud services into a SIEM; define minimum log retention of 12 months and create baseline detection rules.", effort: "High", priority: "High", ref: "NIST CSF 2.0 DE.CM / CIS Control 8" },
  "DE.CM_q3": { action: "Implement User and Entity Behaviour Analytics (UEBA)", detail: "Enable UEBA capabilities within your SIEM or identity platform to baseline normal behaviour and alert on deviations such as unusual login times, data access patterns or lateral movement.", effort: "High", priority: "High", ref: "NIST CSF 2.0 DE.CM-03" },
  "DE.AE_q0": { action: "Define and enforce alert triage SLAs", detail: "Establish documented SLAs for alert investigation by severity, assign triage ownership to named individuals or an MDR provider, and track mean time to investigate.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 DE.AE-02" },
  "DE.AE_q1": { action: "Establish behavioural baselines and detection thresholds", detail: "Define normal operating parameters for key systems and users; configure SIEM or monitoring tooling to alert on deviations and tune thresholds to reduce false positive rates.", effort: "High", priority: "High", ref: "NIST CSF 2.0 DE.AE-02" },
  "DE.AE_q2": { action: "Implement correlation rules for multi-stage attack detection", detail: "Develop SIEM correlation rules based on known attack patterns (MITRE ATT&CK) to detect lateral movement, privilege escalation and data exfiltration chains.", effort: "High", priority: "High", ref: "NIST CSF 2.0 DE.AE-06" },
  "RS.MA_q0": { action: "Develop and maintain an Incident Response Plan", detail: "Produce a documented IRP covering classification criteria, escalation paths, containment playbooks for common incident types and communication protocols; review annually.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 RS.MA-01 / CIS Control 17" },
  "RS.MA_q1": { action: "Define incident classification and severity criteria", detail: "Create a severity matrix (P1–P4) with clear criteria, escalation triggers, response time SLAs and notification obligations for each level.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 RS.MA-02" },
  "RS.MA_q2": { action: "Assign and test IR roles and responsibilities", detail: "Define an Incident Response Team with named primary and backup contacts for each role; validate through tabletop exercises at least annually.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 RS.MA-01" },
  "RS.AN_q0": { action: "Implement a root cause analysis process", detail: "Define an RCA methodology (5 Whys, fishbone or equivalent) and mandate its application for all P1/P2 incidents; track identified root causes to prevent recurrence.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 RS.AN-03" },
  "RS.AN_q1": { action: "Establish forensic evidence preservation procedures", detail: "Document evidence handling procedures covering acquisition, chain of custody, integrity verification and storage; ensure IR team members are trained on legal admissibility requirements.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 RS.AN-03" },
  "RS.AN_q2": { action: "Integrate threat intelligence into incident analysis", detail: "Connect threat intelligence feeds to incident response workflows so that IOCs, TTPs and actor profiles inform containment and eradication decisions during active incidents.", effort: "Medium", priority: "Medium", ref: "NIST CSF 2.0 RS.AN-03" },
  "RS.CO_q0": { action: "Define and test internal incident escalation paths", detail: "Document escalation chains for each incident severity level including out-of-hours contact details; test through annual tabletop exercises.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 RS.CO-02" },
  "RS.CO_q1": { action: "Map and document regulatory notification obligations", detail: "Identify all applicable notification requirements (ICO 72-hour rule, NIS2, sector regulators), assign a compliance owner and include notification triggers in the IRP.", effort: "Low", priority: "Critical", ref: "NIST CSF 2.0 RS.CO-03" },
  "RS.CO_q2": { action: "Develop external communications protocols for incidents", detail: "Prepare pre-approved communication templates for customers, press and regulators; assign a named communications lead and define approval chains before an incident occurs.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 RS.CO-03" },
  "RC.RP_q0": { action: "Develop recovery plans for all critical systems", detail: "Create system-specific recovery runbooks covering rebuild procedures, configuration sources, dependencies and responsible teams; store offline and review annually.", effort: "High", priority: "Critical", ref: "NIST CSF 2.0 RC.RP-01" },
  "RC.RP_q1": { action: "Implement and test the 3-2-1 backup strategy", detail: "Maintain three copies of critical data on two different media types with one copy offsite or offline; test restoration quarterly and document results.", effort: "Medium", priority: "Critical", ref: "NIST CSF 2.0 RC.RP-02 / CIS Control 11" },
  "RC.RP_q2": { action: "Define RTO and RPO for all critical assets", detail: "Work with business owners to agree Recovery Time Objectives and Recovery Point Objectives for each critical system; validate these are achievable through recovery testing.", effort: "Medium", priority: "High", ref: "NIST CSF 2.0 RC.RP-02" },
  "RC.CO_q0": { action: "Establish stakeholder communications during recovery", detail: "Define update cadences and communication templates for keeping internal and external stakeholders informed during recovery operations; assign a communications coordinator.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 RC.CO-03" },
  "RC.CO_q1": { action: "Mandate post-incident reviews with documented outputs", detail: "Require a structured post-incident review within five business days of incident closure; document findings, agreed actions, owners and target dates.", effort: "Low", priority: "High", ref: "NIST CSF 2.0 RC.CO-04" },
  "RC.CO_q2": { action: "Create a lessons learned tracker and close the loop", detail: "Maintain a central register of lessons learned and associated improvement actions; report status to senior management monthly until all actions are closed.", effort: "Low", priority: "Medium", ref: "NIST CSF 2.0 RC.CO-04" },
  "CIS1_q0": { action: "Deploy automated asset discovery and inventory tooling", detail: "Implement active scanning (Lansweeper, runZero or equivalent) to continuously discover and catalogue all hardware assets connected to the network.", effort: "Medium", priority: "Critical", ref: "CIS Control 1.1" },
  "CIS1_q1": { action: "Implement rogue device detection", detail: "Configure network access control (NAC) or DHCP monitoring to detect and alert on unauthorised devices; define a response process for unapproved assets.", effort: "High", priority: "High", ref: "CIS Control 1.2" },
  "CIS1_q2": { action: "Define an asset review and update schedule", detail: "Review and reconcile the asset inventory on at least a quarterly basis; assign an asset owner responsible for accuracy.", effort: "Low", priority: "Medium", ref: "CIS Control 1.1" },
  "CIS2_q0": { action: "Implement software inventory tooling across all endpoints", detail: "Use endpoint management tooling (Intune, SCCM, Jamf) to enumerate all installed software including versions and enforce an application allowlist where feasible.", effort: "Medium", priority: "High", ref: "CIS Control 2.1" },
  "CIS2_q1": { action: "Implement application allowlisting or software restriction policies", detail: "Define an approved software list and block execution of unapproved applications via AppLocker, Windows Defender Application Control or equivalent.", effort: "High", priority: "High", ref: "CIS Control 2.5" },
  "CIS2_q2": { action: "Include version and patch status in software inventory", detail: "Ensure software inventory tracks version numbers and links to vulnerability data to enable identification of unpatched or end-of-life software.", effort: "Low", priority: "Medium", ref: "CIS Control 2.1" },
  "CIS3_q0": { action: "Implement a data classification and handling policy", detail: "Define classification tiers aligned to business sensitivity, document handling requirements for each tier and train all staff on correct data handling practices.", effort: "Medium", priority: "High", ref: "CIS Control 3.1" },
  "CIS3_q1": { action: "Enforce encryption for sensitive data at rest and in transit", detail: "Enable full-disk encryption on endpoints, encrypt sensitive data stores and enforce TLS 1.2 minimum for all data in transit including internal communications.", effort: "Medium", priority: "Critical", ref: "CIS Control 3.6, 3.10" },
  "CIS3_q2": { action: "Implement and enforce a data retention and disposal policy", detail: "Define retention periods, automate deletion where possible and use certified secure disposal methods for physical media containing sensitive data.", effort: "Medium", priority: "High", ref: "CIS Control 3.2" },
  "CIS4_q0": { action: "Adopt and enforce CIS Benchmarks or equivalent hardening standards", detail: "Select the appropriate CIS Benchmark for each OS and application type; implement via GPO, MDM or configuration management tooling and monitor for drift.", effort: "High", priority: "Critical", ref: "CIS Control 4.1" },
  "CIS4_q1": { action: "Remediate all default credentials immediately", detail: "Audit all systems, devices and applications for factory-default or known-default credentials; change immediately and include in build and decommission checklists.", effort: "Low", priority: "Critical", ref: "CIS Control 4.2" },
  "CIS4_q2": { action: "Implement continuous configuration compliance monitoring", detail: "Deploy configuration assessment tooling (CIS-CAT, Ansible compliance scans or equivalent) to detect and alert on drift from approved baselines.", effort: "High", priority: "High", ref: "CIS Control 4.1" },
  "CIS5_q0": { action: "Implement a formal joiners, movers and leavers process", detail: "Define and enforce JML procedures with HR integration ensuring accounts are provisioned on day one and deprovisioned within 24 hours of departure.", effort: "Medium", priority: "Critical", ref: "CIS Control 5.1" },
  "CIS5_q1": { action: "Enforce separation of privileged and standard accounts", detail: "Require all administrators to use separate named accounts for privileged tasks; prohibit the use of shared or generic admin accounts.", effort: "Medium", priority: "Critical", ref: "CIS Control 5.4" },
  "CIS5_q2": { action: "Implement automated detection and disabling of dormant accounts", detail: "Configure identity management tooling to flag accounts inactive for 30+ days; establish an automated or manual review and disable process.", effort: "Low", priority: "High", ref: "CIS Control 5.3" },
  "CIS6_q0": { action: "Enforce least privilege access across all systems", detail: "Audit current access rights against role requirements; remove excess permissions and implement role-based access control (RBAC) with access reviews at least quarterly.", effort: "High", priority: "Critical", ref: "CIS Control 6.1" },
  "CIS6_q1": { action: "Enforce MFA for all remote access and privileged accounts", detail: "Implement phishing-resistant MFA for VPN, RDP, cloud admin portals and all accounts with elevated privileges as an immediate priority.", effort: "Medium", priority: "Critical", ref: "CIS Control 6.3, 6.5" },
  "CIS6_q2": { action: "Conduct periodic access certification reviews", detail: "Schedule quarterly access reviews where line managers certify the continued necessity of each access right for their direct reports.", effort: "Medium", priority: "High", ref: "CIS Control 6.1" },
  "CIS7_q0": { action: "Implement authenticated vulnerability scanning", detail: "Deploy an authenticated scanner (Tenable, Qualys, Rapid7) against all in-scope assets on a monthly or more frequent schedule; include cloud and remote assets.", effort: "Medium", priority: "Critical", ref: "CIS Control 7.1" },
  "CIS7_q1": { action: "Implement risk-based vulnerability remediation SLAs", detail: "Define remediation timelines by CVSS severity, assign owners to each finding and track remediation rate as a security KPI reported to management.", effort: "Medium", priority: "Critical", ref: "CIS Control 7.4" },
  "CIS7_q2": { action: "Schedule annual penetration testing", detail: "Engage a CREST-accredited penetration testing firm to conduct annual tests covering network, application and where relevant social engineering; track all findings to closure.", effort: "Medium", priority: "High", ref: "CIS Control 7.6 / CIS 18" },
  "CIS8_q0": { action: "Enable comprehensive audit logging across all critical systems", detail: "Configure audit logging on all endpoints, servers, network devices, identity systems and cloud services; define a minimum logging standard.", effort: "Medium", priority: "High", ref: "CIS Control 8.1, 8.2" },
  "CIS8_q1": { action: "Centralise log collection and protect log integrity", detail: "Forward all logs to a centralised SIEM or log management platform with write-once storage; ensure log sources cannot modify or delete their own logs.", effort: "High", priority: "High", ref: "CIS Control 8.3" },
  "CIS8_q2": { action: "Define and enforce log retention periods", detail: "Retain security logs for a minimum of 12 months (hot storage 3 months, cold storage 9 months) to support incident investigation and meet regulatory obligations.", effort: "Low", priority: "High", ref: "CIS Control 8.3" },
  "CIS9_q0": { action: "Deploy advanced email filtering and anti-phishing controls", detail: "Implement a gateway email security solution with sandboxing and impersonation protection; configure DMARC in enforcement mode (p=reject) across all sending domains.", effort: "Medium", priority: "Critical", ref: "CIS Control 9.5, 9.6" },
  "CIS9_q1": { action: "Implement DNS-based web filtering", detail: "Deploy a DNS filtering solution (Cisco Umbrella, Cloudflare Gateway or equivalent) to block access to known malicious domains and enforce acceptable use policy.", effort: "Low", priority: "High", ref: "CIS Control 9.3" },
  "CIS9_q2": { action: "Configure DMARC, DKIM and SPF for all domains", detail: "Audit all owned domains for email authentication records; implement SPF, DKIM and DMARC in enforcement mode to prevent domain spoofing.", effort: "Low", priority: "Critical", ref: "CIS Control 9.5" },
  "CIS10_q0": { action: "Deploy anti-malware on all endpoints and servers", detail: "Ensure every endpoint and server has active, up-to-date anti-malware with real-time protection enabled; include mobile devices and any non-Windows platforms.", effort: "Low", priority: "Critical", ref: "CIS Control 10.1" },
  "CIS10_q1": { action: "Deploy EDR across all endpoints prioritising critical systems", detail: "Replace legacy AV with an EDR solution providing behavioural detection and response capability; prioritise servers and endpoints with access to sensitive data or privileged accounts.", effort: "Medium", priority: "Critical", ref: "CIS Control 10.7" },
  "CIS10_q2": { action: "Enforce automatic updates for malware definitions", detail: "Configure anti-malware solutions to update definitions automatically at least daily; monitor for endpoints falling behind and enforce compliance.", effort: "Low", priority: "High", ref: "CIS Control 10.2" },
  "CIS11_q0": { action: "Implement automated backups for all critical data", detail: "Define a backup schedule based on RPO requirements; automate backups for all critical systems and verify completion monitoring with alerting on failures.", effort: "Medium", priority: "Critical", ref: "CIS Control 11.1" },
  "CIS11_q1": { action: "Implement the 3-2-1 backup rule with offline or offsite copy", detail: "Maintain three copies on two media types with one copy stored offline or in an air-gapped environment to ensure resilience against ransomware and site-level failures.", effort: "Medium", priority: "Critical", ref: "CIS Control 11.3" },
  "CIS11_q2": { action: "Test backup restoration on a quarterly schedule", detail: "Conduct documented restoration tests for critical systems at least quarterly; record RTO achieved vs target and remediate gaps in recovery procedures.", effort: "Low", priority: "Critical", ref: "CIS Control 11.4" },
  "CIS12_q0": { action: "Implement network segmentation for critical systems", detail: "Isolate critical systems into dedicated network segments using VLANs and firewall rules enforcing least-privilege inter-segment traffic.", effort: "High", priority: "High", ref: "CIS Control 12.2" },
  "CIS12_q1": { action: "Review and document firewall rules on a defined schedule", detail: "Conduct a firewall rule review at least twice per year; remove unused rules, document the business justification for each rule and enforce a change management process.", effort: "Medium", priority: "High", ref: "CIS Control 12.3" },
  "CIS12_q2": { action: "Restrict and monitor all remote access methods", detail: "Enforce VPN with MFA for all remote access; disable direct RDP and SMB exposure to the internet; log all remote access sessions and review regularly.", effort: "Medium", priority: "Critical", ref: "CIS Control 12.6" },
  "CIS13_q0": { action: "Deploy network monitoring for anomaly detection", detail: "Implement NDR or IDS/IPS tooling at key network chokepoints; configure alerting on anomalous traffic volumes, unusual protocols and known malicious indicators.", effort: "High", priority: "High", ref: "CIS Control 13.1, 13.3" },
  "CIS13_q1": { action: "Deploy intrusion detection or prevention capability", detail: "Implement IDS/IPS on internet-facing and internal network segments; integrate alerts with SIEM and define a response workflow for triggered rules.", effort: "High", priority: "High", ref: "CIS Control 13.3" },
  "CIS13_q2": { action: "Implement DNS filtering to block malicious domains", detail: "Configure recursive DNS to use a security-aware resolver that blocks known malicious, phishing and C2 domains; log DNS queries for retrospective investigation.", effort: "Low", priority: "High", ref: "CIS Control 9.2, 13.1" },
  "CIS14_q0": { action: "Implement a formal security awareness training programme", detail: "Deploy a managed awareness platform with tracked completion, role-based content and at minimum annual renewal; include onboarding training for all new joiners.", effort: "Low", priority: "High", ref: "CIS Control 14.1" },
  "CIS14_q1": { action: "Make awareness training role-specific and current", detail: "Supplement general awareness with role-specific modules for developers, IT admins and executives; update content annually to reflect current threat landscape.", effort: "Medium", priority: "Medium", ref: "CIS Control 14.2" },
  "CIS14_q2": { action: "Measure training effectiveness with phishing simulations", detail: "Run quarterly phishing simulations and track click rates over time; use results to identify repeat clickers for targeted intervention.", effort: "Low", priority: "Medium", ref: "CIS Control 14.9" },
  "CIS15_q0": { action: "Establish a third-party risk assessment process", detail: "Create a supplier risk tier model; require security questionnaire completion and evidence review before onboarding suppliers with access to systems or sensitive data.", effort: "Medium", priority: "High", ref: "CIS Control 15.1" },
  "CIS15_q1": { action: "Embed security requirements in all supplier contracts", detail: "Include standard security clauses covering minimum controls, incident notification obligations (72 hours), audit rights and data handling requirements.", effort: "Medium", priority: "High", ref: "CIS Control 15.1" },
  "CIS15_q2": { action: "Monitor supplier access to systems and data", detail: "Enforce just-in-time access for all supplier remote sessions, log all activity and conduct periodic access reviews to confirm necessity of ongoing supplier access.", effort: "Medium", priority: "High", ref: "CIS Control 15.6" },
  "CIS16_q0": { action: "Adopt a secure development lifecycle (SDLC)", detail: "Implement security requirements gathering, threat modelling and secure code review as mandatory stages in the development process; train developers on OWASP Top 10.", effort: "High", priority: "High", ref: "CIS Control 16.1" },
  "CIS16_q1": { action: "Mandate security testing before application release", detail: "Require SAST and DAST scanning as part of the CI/CD pipeline; conduct annual penetration tests against externally-facing applications.", effort: "Medium", priority: "High", ref: "CIS Control 16.12" },
  "CIS16_q2": { action: "Implement software composition analysis for third-party components", detail: "Use SCA tooling (Snyk, Dependabot or equivalent) to identify vulnerable open source components and enforce a policy for timely remediation.", effort: "Medium", priority: "High", ref: "CIS Control 16.3" },
  "CIS17_q0": { action: "Develop and maintain a formal Incident Response Plan", detail: "Document an IRP covering classification, escalation, containment, eradication and recovery procedures for common incident types; obtain sign-off and store offline.", effort: "Medium", priority: "Critical", ref: "CIS Control 17.1" },
  "CIS17_q1": { action: "Test IR capability through tabletop exercises", detail: "Conduct at least one tabletop exercise per year simulating a realistic threat scenario; document findings and track improvements to the IRP.", effort: "Low", priority: "High", ref: "CIS Control 17.3" },
  "CIS17_q2": { action: "Track post-incident improvements to closure", detail: "Maintain an improvement register capturing all lessons learned actions; assign owners and target dates and report progress to senior management monthly.", effort: "Low", priority: "High", ref: "CIS Control 17.8" },
  "CIS18_q0": { action: "Commission annual penetration testing from a CREST-accredited firm", detail: "Engage a CREST or CHECK-accredited firm for annual penetration testing; ensure scope covers external perimeter, internal network and where applicable web applications.", effort: "Medium", priority: "High", ref: "CIS Control 18.1" },
  "CIS18_q1": { action: "Expand penetration test scope to cover social engineering", detail: "Include phishing and vishing scenarios in annual penetration tests to assess human control effectiveness alongside technical controls.", effort: "Medium", priority: "Medium", ref: "CIS Control 18.2" },
  "CIS18_q2": { action: "Track all penetration test findings to verified remediation", detail: "Log all findings in a remediation tracker with severity, owner and target date; conduct a retest for all Critical and High findings before sign-off.", effort: "Low", priority: "High", ref: "CIS Control 18.5" }
};

// ─── LevelBlue Brand Tokens ───────────────────────────────────────────────────
// Navy: #0A1628  Card: #0D1F3C  Border: #1B3A6B  Blue: #1E6FD9  Cyan: #00BFFF  Lime: #C8F135
const LB = {
  pageBg:   "#08111F",
  cardBg:   "#0D1F3C",
  cardBg2:  "#0A1932",
  border:   "#1B3A6B",
  border2:  "#243F6A",
  blue:     "#1E6FD9",
  cyan:     "#00BFFF",
  lime:     "#C8F135",
  white:    "#FFFFFF",
  text:     "#E2EAF4",
  textMid:  "#8BAAC8",
  textDim:  "#4A6A8A",
  accent:   "#0EA5E9",
};

const FRAMEWORKS = {
  "NIST CSF 2.0": [
    { id:"GV", name:"Govern", color:"#1E6FD9", light:"rgba(30,111,217,0.15)", description:"Organisational context, risk strategy, roles, policy & supply chain", domains:[
      { id:"GV.OC", name:"Organizational Context", questions:[
        "GV.OC-01 — The organizational mission is understood and informs cybersecurity risk management",
        "GV.OC-02 — Internal and external stakeholders are understood and their needs regarding cybersecurity risk management are considered",
        "GV.OC-03 — Legal, regulatory, and contractual requirements regarding cybersecurity are understood and managed",
        "GV.OC-04 — Critical objectives, capabilities, and services that external stakeholders depend on are understood and communicated",
        "GV.OC-05 — Outcomes, capabilities, and services that the organization depends on are understood and communicated"
      ]},
      { id:"GV.RM", name:"Risk Management Strategy", questions:[
        "GV.RM-01 — Risk management objectives are established and agreed to by organizational stakeholders",
        "GV.RM-02 — Risk appetite and risk tolerance statements are established, communicated, and maintained",
        "GV.RM-03 — Organizational risk tolerance is determined, communicated, and reviewed",
        "GV.RM-04 — Strategic direction that describes appropriate risk response options is established and communicated",
        "GV.RM-05 — Lines of communication across the organization are established for cybersecurity risks",
        "GV.RM-06 — A standardized method for calculating, documenting, categorizing, and prioritizing cybersecurity risks is established",
        "GV.RM-07 — Strategic opportunities (positive risks) are characterized and included in cybersecurity risk discussions"
      ]},
      { id:"GV.RR", name:"Roles, Responsibilities & Authorities", questions:[
        "GV.RR-01 — Organizational leadership is responsible and accountable for cybersecurity risk and fosters a risk-aware culture",
        "GV.RR-02 — Roles, responsibilities, and authorities related to cybersecurity risk management are established, communicated, understood, and enforced",
        "GV.RR-03 — Adequate resources are allocated commensurate with the cybersecurity risk strategy, roles, and policies",
        "GV.RR-04 — Cybersecurity is included in human resources practices"
      ]},
      { id:"GV.PO", name:"Policy", questions:[
        "GV.PO-01 — Policy for managing cybersecurity risks is established, communicated, and enforced",
        "GV.PO-02 — Policy for managing cybersecurity risks is reviewed, updated, and enforced to reflect changes in requirements and threats"
      ]},
      { id:"GV.OV", name:"Oversight", questions:[
        "GV.OV-01 — Cybersecurity risk management strategy outcomes are reviewed to inform and adjust strategy and direction",
        "GV.OV-02 — The cybersecurity risk management strategy is reviewed and adjusted to ensure coverage of organizational requirements and risks",
        "GV.OV-03 — Organizational cybersecurity risk management performance is evaluated and reviewed for adjustments needed"
      ]},
      { id:"GV.SC", name:"Supply Chain Risk Management", questions:[
        "GV.SC-01 — A cybersecurity supply chain risk management program, strategy, objectives, policies, and processes are established",
        "GV.SC-02 — Cybersecurity roles and responsibilities for suppliers, customers, and partners are established and coordinated",
        "GV.SC-03 — Cybersecurity supply chain risk management is integrated into cybersecurity and enterprise risk management processes",
        "GV.SC-04 — Suppliers are known and prioritized by criticality",
        "GV.SC-05 — Requirements to address cybersecurity risks in supply chains are integrated into contracts with suppliers",
        "GV.SC-06 — Planning and due diligence are performed to reduce risks before entering formal supplier relationships",
        "GV.SC-07 — The risks posed by suppliers are understood, recorded, assessed, responded to, and monitored over the course of the relationship",
        "GV.SC-08 — Relevant suppliers are included in incident planning, response, and recovery activities",
        "GV.SC-09 — Supply chain security practices are integrated into cybersecurity and enterprise risk management programs",
        "GV.SC-10 — Cybersecurity supply chain risk management plans include provisions for activities after the conclusion of a partnership"
      ]}
    ]},
    { id:"ID", name:"Identify", color:"#00BFFF", light:"rgba(0,191,255,0.12)", description:"Asset management, risk assessment & improvement", domains:[
      { id:"ID.AM", name:"Asset Management", questions:[
        "ID.AM-01 — Inventories of hardware managed by the organization are maintained",
        "ID.AM-02 — Inventories of software, services, and systems managed by the organization are maintained",
        "ID.AM-03 — Representations of the organization's authorized network communication and internal and external data flows are maintained",
        "ID.AM-04 — Inventories of services provided by suppliers are maintained",
        "ID.AM-05 — Assets are prioritized based on classification, criticality, resources, and impact on the mission",
        "ID.AM-06 — Cybersecurity roles and responsibilities for the entire workforce and third parties are established, communicated, and enforced",
        "ID.AM-07 — Inventories of data and corresponding metadata for designated data types are maintained",
        "ID.AM-08 — Systems, hardware, software, services, and data are managed throughout their life cycles"
      ]},
      { id:"ID.RA", name:"Risk Assessment", questions:[
        "ID.RA-01 — Vulnerabilities in assets are identified, validated, and recorded",
        "ID.RA-02 — Cyber threat intelligence is received from information sharing forums and sources",
        "ID.RA-03 — Internal and external threats to the organization are identified and recorded",
        "ID.RA-04 — Potential impacts and likelihoods of threats exploiting vulnerabilities are identified and recorded",
        "ID.RA-05 — Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk and inform risk response prioritization",
        "ID.RA-06 — Risk responses are chosen, prioritized, planned, tracked, and communicated",
        "ID.RA-07 — Changes and exceptions are managed, assessed for risk impact, recorded, and tracked",
        "ID.RA-08 — Processes for receiving, analyzing, and responding to vulnerability disclosures are established",
        "ID.RA-09 — The authenticity and integrity of hardware and software are assessed prior to acquisition and use",
        "ID.RA-10 — Critical suppliers are assessed prior to acquisition"
      ]},
      { id:"ID.IM", name:"Improvement", questions:[
        "ID.IM-01 — Improvements are identified from security program evaluations",
        "ID.IM-02 — Improvements are identified from security tests and exercises, including those done in coordination with suppliers",
        "ID.IM-03 — Improvements are identified from execution of operational processes, procedures, and activities"
      ]}
    ]},
    { id:"PR", name:"Protect", color:"#C8F135", light:"rgba(200,241,53,0.12)", description:"Identity, awareness, data security, platform security & resilience", domains:[
      { id:"PR.AA", name:"Identity Management, Authentication & Access Control", questions:[
        "PR.AA-01 — Identities and credentials for authorized users, services, and hardware are managed by the organization",
        "PR.AA-02 — Identities are proofed and bound to credentials based on the context of interactions",
        "PR.AA-03 — Users, services, and hardware are authenticated",
        "PR.AA-04 — Identity assertions are protected, conveyed, and verified",
        "PR.AA-05 — Access permissions, entitlements, and authorizations are defined in policy, managed, enforced, and reviewed",
        "PR.AA-06 — Physical access to assets is managed, monitored, and enforced commensurate with risk"
      ]},
      { id:"PR.AT", name:"Awareness & Training", questions:[
        "PR.AT-01 — Personnel are provided with awareness and training so that they possess the knowledge and skills to perform general tasks with cybersecurity risks in mind",
        "PR.AT-02 — Individuals in specialized roles are provided with awareness and training so that they possess the knowledge and skills to perform relevant tasks with cybersecurity risks in mind"
      ]},
      { id:"PR.DS", name:"Data Security", questions:[
        "PR.DS-01 — The confidentiality, integrity, and availability of data-at-rest are protected",
        "PR.DS-02 — The confidentiality, integrity, and availability of data-in-transit are protected",
        "PR.DS-03 — Data leakage and exfiltration activities are anticipated, resisted, detected, and mitigated",
        "PR.DS-04 — Adequate capacity to ensure availability is maintained",
        "PR.DS-05 — Protections against data leaks are implemented",
        "PR.DS-06 — Integrity checking mechanisms are used to verify software, firmware, and information integrity",
        "PR.DS-07 — The development and testing environment(s) are separate from the production environment",
        "PR.DS-08 — Integrity checking mechanisms are used to verify hardware integrity",
        "PR.DS-09 — Data is managed throughout its life cycle",
        "PR.DS-10 — Data is destroyed according to policy when no longer needed"
      ]},
      { id:"PR.PS", name:"Platform Security", questions:[
        "PR.PS-01 — Configuration management practices are established and applied",
        "PR.PS-02 — Software is maintained, replaced, and removed commensurate with risk"
      ]},
      { id:"PR.IR", name:"Technology Infrastructure Resilience", questions:[
        "PR.IR-01 — Networks and environments are protected from unauthorized logical access and usage",
        "PR.IR-02 — The organization's technology assets are protected from environmental threats"
      ]}
    ]},
    { id:"DE", name:"Detect", color:"#F59E0B", light:"rgba(245,158,11,0.12)", description:"Continuous monitoring and adverse event analysis", domains:[
      { id:"DE.CM", name:"Continuous Monitoring", questions:[
        "DE.CM-01 — Networks and network services are monitored to find potentially adverse events",
        "DE.CM-02 — The physical environment is monitored to find potentially adverse events",
        "DE.CM-03 — Personnel activity and technology usage are monitored to find potentially adverse events",
        "DE.CM-04 — External service provider activities and services are monitored to find potentially adverse events",
        "DE.CM-05 — Vulnerability scans are performed regularly and patch status is assessed",
        "DE.CM-06 — Authorized users and systems are distinguished from unauthorized users and systems"
      ]},
      { id:"DE.AE", name:"Adverse Event Analysis", questions:[
        "DE.AE-01 — A baseline of network operations and expected data flows for users and systems is established and managed",
        "DE.AE-02 — Potentially adverse events are analyzed to better understand associated activities",
        "DE.AE-03 — Information is correlated from multiple sources to achieve integrated identification of adverse events",
        "DE.AE-04 — The estimated impact and scope of adverse events are understood",
        "DE.AE-05 — Alerts are generated and communicated by cybersecurity technologies to the appropriate personnel"
      ]}
    ]},
    { id:"RS", name:"Respond", color:"#F87171", light:"rgba(248,113,113,0.12)", description:"Incident management, analysis, communication & mitigation", domains:[
      { id:"RS.MA", name:"Incident Management", questions:[
        "RS.MA-01 — The incident response plan is executed in coordination with relevant third parties once an incident is declared",
        "RS.MA-02 — Incident reports are triaged and validated, and security alerts are triaged appropriately",
        "RS.MA-03 — Incidents are categorized and prioritized"
      ]},
      { id:"RS.AN", name:"Incident Analysis", questions:[
        "RS.AN-01 — Notifications from detection systems are investigated to understand the nature of the incident",
        "RS.AN-02 — The impact of the incident is understood",
        "RS.AN-03 — Forensics are performed to better understand the incident and support evidence preservation",
        "RS.AN-04 — Incidents are categorized consistent with response plans",
        "RS.AN-05 — Processes are established to receive, analyze, and respond to vulnerabilities disclosed to the organization"
      ]},
      { id:"RS.CO", name:"Incident Response Reporting & Communication", questions:[
        "RS.CO-01 — Personnel know their roles and order of operations when a response is needed",
        "RS.CO-02 — Incidents are reported consistent with established criteria",
        "RS.CO-03 — Information is shared consistent with response plans"
      ]},
      { id:"RS.MI", name:"Incident Mitigation", questions:[
        "RS.MI-01 — Incidents are contained",
        "RS.MI-02 — Incidents are eradicated"
      ]}
    ]},
    { id:"RC", name:"Recover", color:"#A78BFA", light:"rgba(167,139,250,0.12)", description:"Incident recovery planning and communications", domains:[
      { id:"RC.RP", name:"Incident Recovery Plan Execution", questions:[
        "RC.RP-01 — The recovery portion of the incident response plan is executed once initiated",
        "RC.RP-02 — Recovery actions are selected, scoped, prioritized, and performed",
        "RC.RP-03 — The integrity of backups and other restoration assets is verified before using them for restoration",
        "RC.RP-04 — Critical mission functions and cybersecurity capabilities are re-established",
        "RC.RP-05 — The integrity of restored assets is verified, systems and services are restored, and normal operating status is confirmed"
      ]},
      { id:"RC.CO", name:"Incident Recovery Communication", questions:[
        "RC.CO-01 — Public relations are managed during and following cybersecurity incidents",
        "RC.CO-02 — Reputation of the organization is repaired following an incident",
        "RC.CO-03 — Recovery activities and progress in restoring normal operations are communicated to designated internal and external stakeholders"
      ]}
    ]}
  ],
  "CIS Controls v8": [
    { id: "IG1", name: "Basic Hygiene",   color: "#1E6FD9", light: "rgba(30,111,217,0.15)", description: "Essential cyber hygiene — every organisation", domains: [
      { id: "CIS1", name: "Inventory of Enterprise Assets", questions: ["An inventory of authorised hardware assets is maintained","Unauthorised hardware is detected and addressed","Asset inventory is reviewed and updated regularly"] },
      { id: "CIS2", name: "Inventory of Software Assets",   questions: ["An inventory of authorised software is maintained","Unauthorised software is blocked or removed","Software inventory includes version and patch status"] },
      { id: "CIS3", name: "Data Protection",                questions: ["Data is classified and handled according to sensitivity","Sensitive data is encrypted at rest and in transit","Data retention and disposal processes are followed"] },
      { id: "CIS4", name: "Secure Configuration",           questions: ["Secure configuration baselines exist for all asset types","Default credentials are changed on all systems","Configuration compliance is monitored and enforced"] },
      { id: "CIS5", name: "Account Management",             questions: ["A formal account provisioning and deprovisioning process exists","Privileged accounts are separated from standard user accounts","Dormant accounts are disabled or removed"] },
      { id: "CIS6", name: "Access Control Management",      questions: ["Access rights follow least privilege principles","MFA is enforced for remote access and privileged accounts","Access reviews are conducted periodically"] }
    ]},
    { id: "IG2", name: "Foundational",    color: "#00BFFF", light: "rgba(0,191,255,0.12)", description: "For organisations with IT expertise supporting multiple departments", domains: [
      { id: "CIS7",  name: "Vulnerability Management",  questions: ["Vulnerability scanning is performed on a regular schedule","Vulnerabilities are remediated according to a risk-based priority","Penetration testing is conducted at least annually"] },
      { id: "CIS8",  name: "Audit Log Management",      questions: ["Audit logging is enabled on all critical systems","Logs are centralised and protected from tampering","Log retention meets regulatory and operational requirements"] },
      { id: "CIS9",  name: "Email & Web Protections",   questions: ["Email filtering and anti-phishing controls are deployed","Web filtering or proxy controls are in place","DMARC, DKIM and SPF are configured for email domains"] },
      { id: "CIS10", name: "Malware Defences",          questions: ["Anti-malware solutions are deployed on all endpoints","EDR or behavioural detection is deployed on critical systems","Malware definitions and detection capabilities are kept current"] },
      { id: "CIS11", name: "Data Recovery",             questions: ["Backups are performed on a defined schedule for critical data","Backups are stored securely, ideally offline or offsite","Backup restoration is tested regularly"] },
      { id: "CIS12", name: "Network Management",        questions: ["Network segmentation separates critical systems","Firewall rules are documented and reviewed regularly","Remote access is controlled and monitored"] },
      { id: "CIS13", name: "Network Monitoring",        questions: ["Network traffic is monitored for anomalies","Intrusion detection or prevention systems are deployed","DNS filtering is used to block malicious domains"] }
    ]},
    { id: "IG3", name: "Organisational",  color: "#C8F135", light: "rgba(200,241,53,0.12)", description: "For organisations with dedicated security expertise", domains: [
      { id: "CIS14", name: "Security Awareness Training",  questions: ["A formal security awareness programme exists","Training is role-specific and updated regularly","Training effectiveness is measured"] },
      { id: "CIS15", name: "Service Provider Management",  questions: ["Third-party providers are assessed for security risk","Security requirements are included in supplier contracts","Supplier access to systems and data is monitored"] },
      { id: "CIS16", name: "Application Security",         questions: ["Secure development practices are followed","Applications undergo security testing before release","Third-party components and libraries are managed"] },
      { id: "CIS17", name: "Incident Response",            questions: ["An incident response plan is documented and maintained","IR capability is tested through exercises or simulations","Post-incident reviews drive improvements"] },
      { id: "CIS18", name: "Penetration Testing",          questions: ["Penetration testing is conducted at least annually","Scope covers networks, applications and social engineering","Findings are tracked to remediation"] }
    ]}
  ]
};

// NIST CSF 2.0 Tiers: 0=Not Present, 1=Partial, 2=Risk-Informed, 3=Repeatable, 4=Adaptive
// N/A is stored as -1 and excluded from all score averages
const ML = [
  { value: 0, label: "Not Present",   color: "#F87171", bg: "rgba(248,113,113,0.18)" },
  { value: 1, label: "Partial",       color: "#FB923C", bg: "rgba(251,146,60,0.18)"  },
  { value: 2, label: "Risk-Informed", color: "#FCD34D", bg: "rgba(252,211,77,0.18)"  },
  { value: 3, label: "Repeatable",    color: "#C8F135", bg: "rgba(200,241,53,0.18)"  },
  { value: 4, label: "Adaptive",      color: "#00BFFF", bg: "rgba(0,191,255,0.18)"   }
];
const ML_DESC = [
  "Not Present — cybersecurity risk management is not applied or does not exist",
  "Partial — risk management is ad hoc and reactive; limited awareness",
  "Risk-Informed — practices exist but are not consistently applied organisation-wide",
  "Repeatable — formally approved, consistently applied, risk-informed practices",
  "Adaptive — continuously improved, organisation-wide, anticipates evolving threats"
];
const EFFORT_CFG = { Low: { color: "#C8F135", bg: "rgba(200,241,53,0.15)" }, Medium: { color: "#FCD34D", bg: "rgba(252,211,77,0.15)" }, High: { color: "#F87171", bg: "rgba(248,113,113,0.15)" } };
const PRI_CFG   = { Critical: { color: "#F87171", bg: "rgba(248,113,113,0.15)" }, High: { color: "#FCD34D", bg: "rgba(252,211,77,0.15)" }, Medium: { color: "#00BFFF", bg: "rgba(0,191,255,0.15)" } };

function BarChart({ data, height = 150 }) {
  const max = Math.max(...data.map(d => d.value), 4);
  const w = 100 / data.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      {[1,2,3,4].map(v => { const y = height - (v/max)*(height-20)-4; return <line key={v} x1="0" y1={y} x2="100" y2={y} stroke="#1B3A6B" strokeWidth="0.5"/>; })}
      {data.map((d, i) => {
        const bh = d.value ? (d.value/max)*(height-20) : 0;
        const x = i*w + w*0.15; const bw = w*0.7; const y = height-bh-4;
        return (<g key={i}>
          <rect x={x} y={y} width={bw} height={bh} fill={d.color} rx="1" opacity="0.85"/>
          <text x={x+bw/2} y={height-1} textAnchor="middle" fontSize="3.5" fill="#4A6A8A" fontFamily="Outfit,sans-serif">{d.label}</text>
          {d.value>0 && <text x={x+bw/2} y={y-2} textAnchor="middle" fontSize="4" fill={d.color} fontWeight="700" fontFamily="Outfit,sans-serif">{d.value}</text>}
        </g>);
      })}
    </svg>
  );
}

// ── Horizontal Bar Chart — reliable across all screen sizes ─────────────────
function HBarChart({ data, maxVal }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px", width:"100%" }}>
      {data.map((d, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"42px", fontSize:"11px", fontWeight:"700", color:"#8BAAC8", textAlign:"right", flexShrink:0, fontFamily:"Outfit,sans-serif" }}>{d.label}</div>
          <div style={{ flex:1, height:"22px", background:"#0A1932", borderRadius:"4px", overflow:"hidden", position:"relative" }}>
            <div style={{
              width: d.value > 0 ? `${(d.value/max)*100}%` : "0%",
              height:"100%",
              background: d.color,
              borderRadius:"4px",
              transition:"width 0.5s ease",
              minWidth: d.value > 0 ? "4px" : "0"
            }}/>
          </div>
          <div style={{ width:"36px", fontSize:"13px", fontWeight:"800", color: d.value > 0 ? d.color : "#4A6A8A", textAlign:"left", flexShrink:0, fontFamily:"Outfit,sans-serif" }}>
            {d.value > 0 ? (Number.isInteger(d.value) ? d.value : d.value.toFixed(1)) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function RadarChart({ scores, framework }) {
  const cats = FRAMEWORKS[framework]; const n = cats.length;
  const cx=150, cy=150, r=110; const step=(2*Math.PI)/n;
  const pt=(i,v)=>{ const a=i*step-Math.PI/2; const d=(v/4)*r; return {x:cx+d*Math.cos(a),y:cy+d*Math.sin(a)}; };
  const lp=(i)=>{ const a=i*step-Math.PI/2; return {x:cx+(r+22)*Math.cos(a),y:cy+(r+22)*Math.sin(a)}; };
  return (
    <svg width="300" height="300" viewBox="0 0 300 300">
      {[1,2,3,4].map(lv=>{ const pts=cats.map((_,i)=>pt(i,lv)); const d=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")+"Z"; return <path key={lv} d={d} fill="none" stroke="#1B3A6B" strokeWidth="0.8"/>; })}
      {cats.map((_,i)=>{ const o=pt(i,5); return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="#1B3A6B" strokeWidth="0.8"/>; })}
      {(()=>{ const pts=cats.map((c,i)=>pt(i,scores[c.id]||0)); const d=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")+"Z"; return (<><path d={d} fill="rgba(0,191,255,0.12)" stroke="#00BFFF" strokeWidth="1.5"/>{pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#00BFFF"/>)}</>); })()}
      {cats.map((c,i)=>{ const l=lp(i); return <text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fontWeight="700" fill="#8BAAC8" fontFamily="Outfit,sans-serif">{c.id}</text>; })}
    </svg>
  );
}

function DonutChart({ segments, size=120, thickness=26 }) {
  const r=(size/2)-thickness/2; const circ=2*Math.PI*r;
  const total=segments.reduce((a,s)=>a+s.value,0);
  let offset=0; const cx=size/2, cy=size/2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1B3A6B" strokeWidth={thickness}/>
      {segments.filter(s=>s.value>0).map((seg,i)=>{
        const dash=(seg.value/total)*circ; const gap=circ-dash;
        const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={thickness} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset} style={{transform:"rotate(-90deg)",transformOrigin:"center"}}/>;
        offset+=dash; return el;
      })}
    </svg>
  );
}

const card    = { background:"#0D1F3C", borderRadius:"12px", border:"1px solid #1B3A6B", padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,0.4)" };
const navBtn  = (active) => ({ padding:"6px 16px", borderRadius:"4px", border:"none", background:active?"#1E6FD9":"transparent", color:active?"#FFFFFF":"#4A6A8A", fontSize:"12px", fontWeight:"600", cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" });
const tagSty  = (cfg) => ({ padding:"3px 8px", borderRadius:"4px", fontSize:"10px", fontWeight:"700", background:cfg.bg, color:cfg.color, whiteSpace:"nowrap", letterSpacing:"0.04em" });

export default function MaturityScorecard() {
  const [framework, setFramework] = useState("NIST CSF 2.0");
  const [clientName, setClientName] = useState("");
  const [assessor, setAssessor] = useState("");
  const [clientSector, setClientSector] = useState("");
  const [clientContext, setClientContext] = useState("");
  const [scores, setScores] = useState({});
  const [targetScores, setTargetScores] = useState({});
  const [notes, setNotes] = useState({});
  const [workshopNotes, setWorkshopNotes] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [view, setView] = useState("setup");
  const [expandedDomains, setExpandedDomains] = useState({});
  const [resultsTab, setResultsTab] = useState("overview");
  const [statusMsg, setStatusMsg] = useState("");
  const [showWorkshop, setShowWorkshop] = useState({});
  const [generatingReport, setGeneratingReport] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const fileInputRef = useRef();

  const fw = FRAMEWORKS[framework];
  const isNIST = framework === "NIST CSF 2.0";
  const flash = (msg) => { setStatusMsg(msg); setTimeout(()=>setStatusMsg(""),3000); };

  // ── Autosave to localStorage — crash recovery buffer ─────────────────────
  // This is NOT the primary save mechanism. It's a recovery net only.
  // Primary save remains JSON export — no client data persists in the browser
  // beyond the session. This buffer is cleared when JSON is exported.
  useEffect(() => {
    if (!clientName && Object.keys(scores).length === 0) return; // don't save empty sessions
    const backup = { version:2, framework, clientName, assessor, clientSector, clientContext,
      date: new Date().toISOString(), scores, targetScores, notes, workshopNotes };
    try { localStorage.setItem("lb_scorecard_recovery", JSON.stringify(backup)); } catch(e) {}
  }, [scores, targetScores, notes, workshopNotes, clientName, assessor, clientSector, clientContext, framework]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lb_scorecard_recovery");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.clientName || Object.keys(data.scores||{}).length > 0) {
          setRecoveryAvailable(true);
        }
      }
    } catch(e) {}
  }, []);

  function restoreRecovery() {
    try {
      const saved = localStorage.getItem("lb_scorecard_recovery");
      if (!saved) return;
      const data = JSON.parse(saved);
      setFramework(data.framework || "NIST CSF 2.0");
      setClientName(data.clientName || "");
      setAssessor(data.assessor || "");
      setClientSector(data.clientSector || "");
      setClientContext(data.clientContext || "");
      setScores(data.scores || {});
      setTargetScores(data.targetScores || {});
      setNotes(data.notes || {});
      setWorkshopNotes(data.workshopNotes || {});
      setRecoveryAvailable(false);
      flash("Session recovered ✓");
    } catch(e) { flash("Recovery failed"); }
  }

  function dismissRecovery() {
    try { localStorage.removeItem("lb_scorecard_recovery"); } catch(e) {}
    setRecoveryAvailable(false);
  }

  const getMC = (s) => { if(s===null||s===undefined) return "#4A6A8A"; const v=parseFloat(s); if(v<0.5) return "#F87171"; if(v<1.5) return "#FB923C"; if(v<2.5) return "#FCD34D"; if(v<3.5) return "#C8F135"; return "#00BFFF"; };
  const getML = (s) => { if(s===null||s===undefined) return "Not assessed"; const v=parseFloat(s); if(v<0.5) return "Not Present"; if(v<1.5) return "Partial"; if(v<2.5) return "Risk-Informed"; if(v<3.5) return "Repeatable"; return "Adaptive"; };

  // Current scoring — N/A = -1, excluded from averages
  const domainScore = (d) => { const vals=d.questions.map((_,qi)=>scores[`${d.id}_q${qi}`]).filter(v=>v!==undefined&&v!==-1); return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2):null; };
  const catScore = (cat) => { const ds=cat.domains.map(d=>domainScore(d)).filter(v=>v!==null); return ds.length?(ds.reduce((a,b)=>a+parseFloat(b),0)/ds.length).toFixed(2):null; };
  const overall = (()=>{ const cs=fw.map(c=>catScore(c)).filter(v=>v!==null); return cs.length?(cs.reduce((a,b)=>a+parseFloat(b),0)/cs.length).toFixed(2):null; })();

  // Target scoring — defaults to current score if not explicitly set
  const domainTarget = (d) => {
    const vals = d.questions.map((_,qi) => {
      const key = `${d.id}_q${qi}`;
      const t = targetScores[key];
      const c = scores[key];
      // use explicit target if set, else fall back to current, exclude -1
      const v = t !== undefined ? t : c;
      return (v !== undefined && v !== -1) ? v : undefined;
    }).filter(v => v !== undefined);
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : null;
  };
  const catTarget = (cat) => { const ds=cat.domains.map(d=>domainTarget(d)).filter(v=>v!==null); return ds.length?(ds.reduce((a,b)=>a+parseFloat(b),0)/ds.length).toFixed(2):null; };
  const overallTarget = (()=>{ const cs=fw.map(c=>catTarget(c)).filter(v=>v!==null); return cs.length?(cs.reduce((a,b)=>a+parseFloat(b),0)/cs.length).toFixed(2):null; })();

  const completion = (()=>{ const total=fw.flatMap(c=>c.domains.flatMap(d=>d.questions)).length; const done=Object.values(scores).filter(v=>v!==undefined).length; return Math.round((done/total)*100); })();
  const radarScores = {}; fw.forEach(cat=>{ const sc=catScore(cat); radarScores[cat.id]=sc?parseFloat(sc):0; });

  // Gaps: current score below 3 (Repeatable), excluding N/A
  const getAllGaps = useCallback(()=>{
    const gaps=[];
    fw.forEach(cat=>{ cat.domains.forEach(domain=>{ domain.questions.forEach((q,qi)=>{ const key=`${domain.id}_q${qi}`; const sc=scores[key]; if(sc!==undefined&&sc!==-1&&sc<3) gaps.push({cat,domain,q,sc,key,rec:RECS[key]}); }); }); });
    return gaps.sort((a,b)=>a.sc-b.sc);
  },[fw,scores]);

  // ── JSON Save / Load ─────────────────────────────────────────────────────
  function saveSession() {
    const session = { version:2, framework, clientName, assessor, clientSector, clientContext, date:new Date().toISOString(), scores, targetScores, notes, workshopNotes };
    const blob = new Blob([JSON.stringify(session, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(clientName||"session").replace(/\s+/g,"-")}-scorecard-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    try { localStorage.removeItem("lb_scorecard_recovery"); } catch(e) {}
    setRecoveryAvailable(false);
    flash("Session saved ✓");
  }

  function loadSession(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        setFramework(data.framework || "NIST CSF 2.0");
        setClientName(data.clientName || "");
        setAssessor(data.assessor || "");
        setClientSector(data.clientSector || "");
        setClientContext(data.clientContext || "");
        setScores(data.scores || {});
        setTargetScores(data.targetScores || {});
        setNotes(data.notes || {});
        setWorkshopNotes(data.workshopNotes || {});
        flash("Session loaded ✓");
      } catch { flash("Error: invalid session file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Excel Export ─────────────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryRows = [
      ["LEVELBLUE CYBER MATURITY SCORECARD — NIST CSF 2.0"],
      [],
      ["Client", clientName || "Not specified"],
      ["Sector", clientSector || "Not specified"],
      ["Assessor", assessor || "Not specified"],
      ["Framework", framework],
      ["Date", new Date().toLocaleDateString("en-GB")],
      [],
      ["OVERALL SCORES"],
      ["", "Current Score", "Current Tier", "Target Score", "Target Tier", "Gap"],
      ["Overall", overall||"—", getML(overall), overallTarget||"—", getML(overallTarget),
        overall&&overallTarget ? (parseFloat(overallTarget)-parseFloat(overall)).toFixed(2) : "—"],
      [],
      ["FUNCTION SCORES"],
      ["Function", "Current Score", "Current Tier", "Target Score", "Target Tier", "Gap"],
      ...fw.map(cat => {
        const cur = catScore(cat); const tgt = catTarget(cat);
        return [cat.id+" — "+cat.name, cur||"—", getML(cur), tgt||"—", getML(tgt),
          cur&&tgt?(parseFloat(tgt)-parseFloat(cur)).toFixed(2):"—"];
      }),
      [],
      ["GAP SUMMARY"],
      ["Priority", "Count"],
      ...["Critical","High","Medium"].map(p => [p, getAllGaps().filter(g=>g.rec?.priority===p).length])
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{wch:32},{wch:14},{wch:16},{wch:14},{wch:16},{wch:8}];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const scoredRows = [
      ["Function","Category ID","Category","Subcategory ID","Subcategory Statement","Current Score","Current Tier","Target Score","Target Tier","Gap","Evidence Note","Priority","Recommended Action","Effort","Reference"]
    ];
    fw.forEach(cat => {
      cat.domains.forEach(domain => {
        domain.questions.forEach((q, qi) => {
          const key = `${domain.id}_q${qi}`;
          const sc = scores[key]; const tgt = targetScores[key] !== undefined ? targetScores[key] : sc;
          const [subId,...rest] = q.split(" — ");
          scoredRows.push([
            cat.name, domain.id, domain.name, subId||domain.id+"-"+(qi+1), rest.join(" — ")||q,
            sc!==-1&&sc!==undefined?sc:"", sc!==-1&&sc!==undefined?getML(sc):"",
            tgt!==-1&&tgt!==undefined?tgt:"", tgt!==-1&&tgt!==undefined?getML(tgt):"",
            sc!==-1&&sc!==undefined&&tgt!==-1&&tgt!==undefined?(tgt-sc).toFixed(0):"",
            notes[key]||"", RECS[key]?.priority||"", RECS[key]?.action||"", RECS[key]?.effort||"", RECS[key]?.ref||""
          ]);
        });
      });
    });
    const wsScored = XLSX.utils.aoa_to_sheet(scoredRows);
    wsScored["!cols"] = [{wch:12},{wch:10},{wch:30},{wch:12},{wch:60},{wch:8},{wch:14},{wch:8},{wch:14},{wch:5},{wch:40},{wch:10},{wch:50},{wch:9},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsScored, "Scored Controls");

    // Sheet 3: Gaps & Recommendations only
    const gapRows = [["Priority","Function","Domain","Control Statement","Score","Maturity Level","Evidence Note","Recommended Action","Detail","Effort","Reference"]];
    getAllGaps().forEach(({cat,domain,q,sc,key,rec}) => {
      const ml = ML.find(m=>m.value===sc)?.label||"";
      gapRows.push([rec?.priority||"", cat.name, domain.name, q, sc, ml, notes[key]||"", rec?.action||"", rec?.detail||"", rec?.effort||"", rec?.ref||""]);
    });
    const wsGaps = XLSX.utils.aoa_to_sheet(gapRows);
    wsGaps["!cols"] = [{wch:10},{wch:14},{wch:24},{wch:52},{wch:7},{wch:14},{wch:40},{wch:44},{wch:60},{wch:9},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsGaps, "Gaps and Recommendations");

    // Sheet 4: Workshop Notes
    const workshopRows = [["Domain ID","Domain Name","Workshop Questions","Workshop Notes"]];
    fw.forEach(cat => {
      cat.domains.forEach(domain => {
        const qs = (WORKSHOP_QS[domain.id] || []).join("\n");
        const wn = workshopNotes[domain.id] || "";
        workshopRows.push([domain.id, domain.name, qs, wn]);
      });
    });
    const wsWorkshop = XLSX.utils.aoa_to_sheet(workshopRows);
    wsWorkshop["!cols"] = [{wch:12},{wch:28},{wch:60},{wch:60}];
    XLSX.utils.book_append_sheet(wb, wsWorkshop, "Workshop Notes");

    XLSX.writeFile(wb, `${(clientName||"client").replace(/\s+/g,"-")}-maturity-scorecard.xlsx`);
    flash("Excel exported ✓");
  }

  // ── PPTX Report Generator — aligned to LevelBlue NIST Assessment Template ──
  // Requires: npm install pptxgenjs
  async function exportPPTXReport() {
    if (!isNIST) { flash("PPTX report is for NIST CSF 2.0 only"); return; }
    setGeneratingReport(true);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const prs = new PptxGenJS();
      prs.layout = "LAYOUT_WIDE";

      // ── Colour palette ────────────────────────────────────────────────
      const N="08111F", CARD="0D1F3C", CARD2="0A1932", BD="1B3A6B";
      const BL="1E6FD9", CY="00BFFF", LI="C8F135";
      const WH="FFFFFF", TM="8BAAC8", TD="4A6A8A";
      const client  = clientName   || "CLIENT NAME";
      const asses   = assessor     || "LevelBlue";
      const sector  = clientSector || "Not specified";
      const context = clientContext|| "";
      const date    = new Date().toLocaleDateString("en-GB", { month:"long", year:"numeric" });
      const gaps    = getAllGaps();
      const critN   = gaps.filter(g=>g.rec?.priority==="Critical").length;
      const highN   = gaps.filter(g=>g.rec?.priority==="High").length;
      const medN    = gaps.filter(g=>g.rec?.priority==="Medium").length;
      const lowN    = gaps.filter(g=>g.rec?.priority==="Low").length;

      const bg  = s => { s.background = { color: N }; };
      const hdr = (s, label, col=CY) => {
        s.addShape(prs.ShapeType.rect, { x:0.5, y:0.07, w:12.33, h:0.03, fill:{ color:col }, line:{ color:col, width:0 } });
        s.addText(label, { x:0.5, y:0.22, w:10, h:0.26, fontSize:8, color:col, fontFace:"Calibri", bold:true, charSpacing:5 });
      };
      const foot = s => s.addText(`${asses}  ·  ${client}  ·  NIST CSF 2.0  ·  ${date}  ·  CONFIDENTIAL`, { x:0.5, y:7.22, w:12.33, h:0.2, fontSize:7.5, color:TD, fontFace:"Calibri" });
      const scoreCol = sc => { if(sc===null||sc===undefined) return TM; const v=parseFloat(sc); if(v<0.5) return "F87171"; if(v<1.5) return "FB923C"; if(v<2.5) return "FCD34D"; if(v<3.5) return LI; return CY; };
      const tierStr  = sc => getML(sc);
      const mkCell   = (text, fill, color, opts={}) => ({ text, options:{ fill:{ color:fill }, color, fontFace:"Calibri", valign:"middle", margin:7, ...opts } });

      // ── SLIDE 1 — Cover ───────────────────────────────────────────────
      const s1 = prs.addSlide(); bg(s1);
      s1.addShape(prs.ShapeType.rect, { x:0, y:0, w:0.38, h:7.5, fill:{ color:BL }, line:{ color:BL, width:0 } });
      s1.addShape(prs.ShapeType.rect, { x:0, y:6.85, w:13.33, h:0.65, fill:{ color:CARD }, line:{ color:CARD, width:0 } });
      ["1E6FD9","00BFFF","C8F135"].forEach((c,i) => s1.addShape(prs.ShapeType.rect, { x:0.68+i*0.16, y:0.5, w:0.11, h:0.5, fill:{ color:c }, line:{ color:c, width:0 } }));
      s1.addText("LevelBlue", { x:0.6, y:1.25, w:10, h:0.4, fontSize:12, color:TM, fontFace:"Calibri", bold:true });
      s1.addText("Cyber Risk Maturity Assessment", { x:0.6, y:1.7, w:11, h:0.9, fontSize:32, color:WH, fontFace:"Calibri", bold:true });
      s1.addText("Final Report", { x:0.6, y:2.65, w:9, h:0.65, fontSize:26, color:CY, fontFace:"Calibri", bold:true });
      s1.addShape(prs.ShapeType.rect, { x:0.6, y:3.44, w:7.5, h:0.04, fill:{ color:BD }, line:{ color:BD, width:0 } });
      s1.addText(date, { x:0.6, y:3.6, w:6, h:0.35, fontSize:13, color:TM, fontFace:"Calibri" });
      s1.addText(`Prepared for ${client} by ${asses}`, { x:0.6, y:4.0, w:9, h:0.35, fontSize:12, color:TM, fontFace:"Calibri", italic:true });
      if(overall) {
        s1.addText(`Current Score: ${parseFloat(overall).toFixed(2)} / 4.0 — ${tierStr(overall)}`, { x:0.6, y:4.9, w:9, h:0.45, fontSize:17, color:scoreCol(overall), fontFace:"Calibri", bold:true });
        if(overallTarget) s1.addText(`Target Score: ${parseFloat(overallTarget).toFixed(2)} / 4.0 — ${tierStr(overallTarget)}`, { x:0.6, y:5.4, w:9, h:0.4, fontSize:14, color:CY, fontFace:"Calibri" });
      }
      s1.addText("CONFIDENTIAL — NOT FOR DISTRIBUTION", { x:0.6, y:7.0, w:10, h:0.28, fontSize:9, color:TD, fontFace:"Calibri" });

      // ── SLIDE 2 — Executive Summary: Introduction ─────────────────────
      const s2 = prs.addSlide(); bg(s2); hdr(s2, "EXECUTIVE SUMMARY"); foot(s2);
      s2.addText("Introduction", { x:0.5, y:0.52, w:12, h:0.55, fontSize:22, color:WH, fontFace:"Calibri", bold:true });
      const introBody = `${asses} was engaged by ${client} to provide a view of cyber security maturity in line with the NIST Cybersecurity Framework (CSF) 2.0. NIST CSF is widely adopted across industries and accepted by regulatory bodies.\n\n${asses} has conducted a comprehensive assessment covering all six NIST CSF function areas: Govern, Identify, Protect, Detect, Respond and Recover — scoring each of the 106 subcategories across 22 categories.\n\nNIST CSF maturity scores range from 0–4 (Not Present → Partial → Risk-Informed → Repeatable → Adaptive). ${client} achieved a current profile score of ${overall?parseFloat(overall).toFixed(2):"TBC"} (${tierStr(overall)}).${overallTarget?" A target of "+parseFloat(overallTarget).toFixed(2)+" ("+tierStr(overallTarget)+") has been identified and agreed as an appropriate balance of investment and security for "+client+".":""}`;
      s2.addText(introBody, { x:0.5, y:1.18, w:7.7, h:3.5, fontSize:11, color:TM, fontFace:"Calibri", valign:"top" });

      // Score callouts right side
      const scoreItems = [
        { label:"Current Score", val:overall?parseFloat(overall).toFixed(2):"TBC", col:scoreCol(overall), tier:tierStr(overall) },
        { label:"Target Score",  val:overallTarget?parseFloat(overallTarget).toFixed(2):"TBC", col:CY, tier:tierStr(overallTarget) },
        { label:"Gaps Identified", val:String(gaps.length), col:"F87171", tier:`${critN+highN} High/Critical` },
      ];
      scoreItems.forEach(({label,val,col,tier},i) => {
        const bx=8.6, by=1.18+i*1.52;
        s2.addShape(prs.ShapeType.rect, { x:bx, y:by, w:4.18, h:1.3, fill:{ color:CARD }, line:{ color:col, width:1.5 } });
        s2.addShape(prs.ShapeType.rect, { x:bx, y:by, w:4.18, h:0.05, fill:{ color:col }, line:{ color:col, width:0 } });
        s2.addText(val, { x:bx+0.2, y:by+0.1, w:3.8, h:0.7, fontSize:34, color:col, fontFace:"Calibri", bold:true });
        s2.addText(label, { x:bx+0.2, y:by+0.82, w:3.8, h:0.3, fontSize:10, color:TM, fontFace:"Calibri", bold:true });
        s2.addText(tier, { x:bx+0.2, y:by+1.08, w:3.8, h:0.2, fontSize:9, color:TD, fontFace:"Calibri" });
      });

      // Key findings table
      s2.addText("Key Findings and Opportunities", { x:0.5, y:4.85, w:8, h:0.3, fontSize:12, color:WH, fontFace:"Calibri", bold:true });
      const kfRows = [
        [mkCell("Area","1E3A6B",WH,{bold:true,fontSize:10}), mkCell("Priority","1E3A6B",WH,{bold:true,fontSize:10}), mkCell("Key Finding","1E3A6B",WH,{bold:true,fontSize:10})],
        ...fw.map((cat,ri) => {
          const catGaps = gaps.filter(g=>g.cat.id===cat.id);
          const topGap = catGaps[0];
          const pri = topGap?.rec?.priority || (catGaps.length>0?"Medium":"—");
          const finding = topGap?.rec?.action || (catGaps.length>0?`${catGaps.length} subcategories below target threshold`:"No gaps identified");
          const fill = ri%2===0?CARD:CARD2;
          return [mkCell(cat.id+" — "+cat.name,fill,WH,{fontSize:9}), mkCell(pri,fill,PRI_CFG[pri]?.color?.replace("#","")||TM,{fontSize:9,bold:true}), mkCell(finding,fill,TM,{fontSize:9})];
        })
      ];
      s2.addTable(kfRows, { x:0.5, y:5.2, w:12.33, colW:[2.8,1.3,8.23], border:{ pt:0.4, color:BD } });

      // ── SLIDE 3 — Executive Summary: Background / Journey to Target ───
      const s3 = prs.addSlide(); bg(s3); hdr(s3, "EXECUTIVE SUMMARY"); foot(s3);
      s3.addText("Background — Journey to Target Profile", { x:0.5, y:0.52, w:12, h:0.55, fontSize:22, color:WH, fontFace:"Calibri", bold:true });
      s3.addText(`As a first step to work towards a target profile score of ${overallTarget?parseFloat(overallTarget).toFixed(2):"the agreed target"}, ${asses} recommends that ${client} focus on the priority workstreams identified below. The recommendations have been prioritised to maximise the impact on cybersecurity risk reduction within an achievable implementation timeframe.`, { x:0.5, y:1.18, w:12.33, h:0.65, fontSize:11, color:TM, fontFace:"Calibri" });

      // Current vs target table
      const cvtHdr = [mkCell("Function","1E3A6B",WH,{bold:true,fontSize:10}), mkCell("Current","1E3A6B",WH,{bold:true,fontSize:10}), mkCell("Current Tier","1E3A6B",WH,{bold:true,fontSize:10}), mkCell("Target","1E3A6B",CY,{bold:true,fontSize:10}), mkCell("Target Tier","1E3A6B",CY,{bold:true,fontSize:10}), mkCell("Gap","1E3A6B",LI,{bold:true,fontSize:10})];
      const cvtRows = [cvtHdr, ...fw.map((cat,ri)=>{
        const sc=catScore(cat); const tgt=catTarget(cat);
        const gap = sc&&tgt?(parseFloat(tgt)-parseFloat(sc)).toFixed(2):"—";
        const fill=ri%2===0?CARD:CARD2;
        return [mkCell(cat.id+" — "+cat.name,fill,WH,{fontSize:10}), mkCell(sc||"—",fill,sc?scoreCol(sc):TD,{fontSize:12,bold:true}), mkCell(tierStr(sc),fill,sc?scoreCol(sc):TD,{fontSize:10}), mkCell(tgt||"—",fill,CY,{fontSize:12,bold:true}), mkCell(tierStr(tgt),fill,CY,{fontSize:10}), mkCell(gap,fill,parseFloat(gap)>0?LI:TD,{fontSize:11,bold:true})];
      }), [mkCell("OVERALL","1E3A6B",WH,{bold:true,fontSize:11}), mkCell(overall||"—","1E3A6B",overall?scoreCol(overall):TD,{fontSize:14,bold:true}), mkCell(tierStr(overall),"1E3A6B",overall?scoreCol(overall):TD,{fontSize:10,bold:true}), mkCell(overallTarget||"—","1E3A6B",CY,{fontSize:14,bold:true}), mkCell(tierStr(overallTarget),"1E3A6B",CY,{fontSize:10,bold:true}), mkCell(overall&&overallTarget?(parseFloat(overallTarget)-parseFloat(overall)).toFixed(2):"—","1E3A6B",LI,{fontSize:12,bold:true})]];
      s3.addTable(cvtRows, { x:0.5, y:1.95, w:12.33, colW:[3.4,1.3,2.3,1.3,2.3,1.73], border:{ pt:0.4, color:BD } });

      // Workstream summary
      s3.addText("Summary of Improvement Workstreams", { x:0.5, y:5.35, w:8, h:0.3, fontSize:12, color:WH, fontFace:"Calibri", bold:true });
      const wsRows = [
        [mkCell("Priority","1E3A6B",WH,{bold:true,fontSize:10}), mkCell("Count","1E3A6B",WH,{bold:true,fontSize:10}), mkCell("Scope","1E3A6B",WH,{bold:true,fontSize:10})],
        [mkCell("Critical","F87171"+"22","F87171",{bold:true,fontSize:10}), mkCell(String(critN),"F87171"+"22","F87171",{fontSize:13,bold:true}), mkCell(gaps.filter(g=>g.rec?.priority==="Critical").slice(0,3).map(g=>g.rec?.action||g.domain.id).join(" · "),"F87171"+"22",WH,{fontSize:9})],
        [mkCell("High","FCD34D"+"22","FCD34D",{bold:true,fontSize:10}), mkCell(String(highN),"FCD34D"+"22","FCD34D",{fontSize:13,bold:true}), mkCell(gaps.filter(g=>g.rec?.priority==="High").slice(0,3).map(g=>g.rec?.action||g.domain.id).join(" · "),"FCD34D"+"22",WH,{fontSize:9})],
        [mkCell("Medium","00BFFF"+"22","00BFFF",{bold:true,fontSize:10}), mkCell(String(medN),"00BFFF"+"22","00BFFF",{fontSize:13,bold:true}), mkCell(gaps.filter(g=>g.rec?.priority==="Medium").slice(0,3).map(g=>g.rec?.action||g.domain.id).join(" · "),"00BFFF"+"22",WH,{fontSize:9})],
      ];
      s3.addTable(wsRows, { x:0.5, y:5.7, w:12.33, colW:[1.5,1.0,9.83], border:{ pt:0.4, color:BD } });

      // ── SLIDE 4 — Introduction: Client Overview ───────────────────────
      const s4 = prs.addSlide(); bg(s4); hdr(s4,"INTRODUCTION",BL); foot(s4);
      s4.addText("Client Overview", { x:0.5, y:0.52, w:12, h:0.55, fontSize:22, color:WH, fontFace:"Calibri", bold:true });
      s4.addShape(prs.ShapeType.rect, { x:0.5, y:1.18, w:5.9, h:5.8, fill:{ color:CARD }, line:{ color:BD, width:1 } });
      s4.addShape(prs.ShapeType.rect, { x:0.5, y:1.18, w:5.9, h:0.05, fill:{ color:BL }, line:{ color:BL, width:0 } });
      s4.addText("ENGAGEMENT", { x:0.7, y:1.28, w:5.5, h:0.28, fontSize:9, color:CY, fontFace:"Calibri", bold:true, charSpacing:4 });
      s4.addText(`${asses} was engaged by ${client} to provide a view of the maturity and appropriateness of policies, processes, and strategies, identifying key strengths, risks, and recommended areas for improvement in line with the NIST Cybersecurity Framework (CSF) 2.0.`, { x:0.7, y:1.62, w:5.5, h:1.2, fontSize:11, color:TM, fontFace:"Calibri" });
      s4.addText("BUSINESS CONTEXT", { x:0.7, y:2.95, w:5.5, h:0.28, fontSize:9, color:CY, fontFace:"Calibri", bold:true, charSpacing:4 });
      s4.addText(context||"Business context to be completed by the assessor.", { x:0.7, y:3.28, w:5.5, h:1.5, fontSize:11, color:TM, fontFace:"Calibri" });
      s4.addText("SECTOR", { x:0.7, y:4.9, w:5.5, h:0.28, fontSize:9, color:CY, fontFace:"Calibri", bold:true, charSpacing:4 });
      s4.addText(sector, { x:0.7, y:5.22, w:5.5, h:0.4, fontSize:13, color:WH, fontFace:"Calibri", bold:true });

      s4.addShape(prs.ShapeType.rect, { x:6.93, y:1.18, w:5.9, h:5.8, fill:{ color:CARD }, line:{ color:BD, width:1 } });
      s4.addShape(prs.ShapeType.rect, { x:6.93, y:1.18, w:5.9, h:0.05, fill:{ color:CY }, line:{ color:CY, width:0 } });
      s4.addText("ASSESSMENT SCOPE", { x:7.13, y:1.28, w:5.5, h:0.28, fontSize:9, color:CY, fontFace:"Calibri", bold:true, charSpacing:4 });
      [
        { label:"Framework", val:"NIST CSF 2.0" },
        { label:"Functions", val:"6 (GV, ID, PR, DE, RS, RC)" },
        { label:"Categories", val:"22" },
        { label:"Subcategories", val:"106" },
        { label:"Scoring Scale", val:"0 (Not Present) → 4 (Adaptive)" },
        { label:"Assessor", val:asses },
        { label:"Date", val:date },
        { label:"Overall Score", val:overall?parseFloat(overall).toFixed(2)+" — "+tierStr(overall):"TBC" },
        { label:"Target Score", val:overallTarget?parseFloat(overallTarget).toFixed(2)+" — "+tierStr(overallTarget):"TBC" },
      ].forEach(({label,val},i) => {
        s4.addText(label+":", { x:7.13, y:1.65+i*0.44, w:2.2, h:0.38, fontSize:10, color:TD, fontFace:"Calibri", bold:true });
        s4.addText(val, { x:9.38, y:1.65+i*0.44, w:3.25, h:0.38, fontSize:10, color:WH, fontFace:"Calibri" });
      });

      // ── SLIDE 5 — NIST Analysis: All Categories ───────────────────────
      const s5 = prs.addSlide(); bg(s5); hdr(s5,"NIST CYBERSECURITY FRAMEWORK ANALYSIS",LI); foot(s5);
      s5.addText("Category Scores — Current vs Target", { x:0.5, y:0.52, w:12, h:0.55, fontSize:22, color:WH, fontFace:"Calibri", bold:true });
      const catHdr = [mkCell("ID","1E3A6B",WH,{bold:true,fontSize:9}), mkCell("Category","1E3A6B",WH,{bold:true,fontSize:9}), mkCell("Current","1E3A6B",WH,{bold:true,fontSize:9}), mkCell("Tier","1E3A6B",WH,{bold:true,fontSize:9}), mkCell("Target","1E3A6B",CY,{bold:true,fontSize:9}), mkCell("Target Tier","1E3A6B",CY,{bold:true,fontSize:9}), mkCell("Gaps","1E3A6B","F87171",{bold:true,fontSize:9})];
      let catTblRows=[catHdr]; let ri3=0;
      fw.forEach(cat=>{
        // Function sub-header
        catTblRows.push([mkCell(cat.id,"1B3A6B",cat.color.replace("#",""),{bold:true,fontSize:10,colspan:1}), mkCell(cat.name+" — "+cat.description,"1B3A6B",cat.color.replace("#",""),{bold:false,fontSize:9,colspan:6}), mkCell(catScore(cat)||"—","1B3A6B",cat.color.replace("#",""),{bold:true,fontSize:11}), mkCell(tierStr(catScore(cat)),"1B3A6B",TM,{fontSize:9}), mkCell(catTarget(cat)||"—","1B3A6B",CY,{bold:true,fontSize:11}), mkCell(tierStr(catTarget(cat)),"1B3A6B",CY,{fontSize:9}), mkCell(String(gaps.filter(g=>g.cat.id===cat.id).length),"1B3A6B",gaps.filter(g=>g.cat.id===cat.id).length>0?"F87171":TD,{bold:true,fontSize:10})]);
        cat.domains.forEach(domain=>{
          const ds=domainScore(domain); const dt=domainTarget(domain); const dg=gaps.filter(g=>g.domain.id===domain.id).length;
          const fill=ri3%2===0?CARD:CARD2;
          catTblRows.push([mkCell(domain.id,fill,cat.color.replace("#",""),{fontSize:9,bold:true}), mkCell(domain.name,fill,WH,{fontSize:9}), mkCell(ds||"—",fill,ds?scoreCol(ds):TD,{fontSize:10,bold:true}), mkCell(tierStr(ds),fill,ds?scoreCol(ds):TD,{fontSize:9}), mkCell(dt||"—",fill,CY,{fontSize:10,bold:true}), mkCell(tierStr(dt),fill,CY,{fontSize:9}), mkCell(dg>0?String(dg):"—",fill,dg>0?"F87171":TD,{fontSize:9,bold:dg>0})]);
          ri3++;
        });
      });
      s5.addTable(catTblRows, { x:0.5, y:1.15, w:12.33, colW:[1.35,4.2,1.1,1.75,1.1,1.75,1.08], border:{ pt:0.4, color:BD } });

      // ── SLIDE 6 — Detailed Recommendations: Critical & High ───────────
      const critHighGaps = gaps.filter(g=>g.rec?.priority==="Critical"||g.rec?.priority==="High");
      if(critHighGaps.length>0) {
        const s6 = prs.addSlide(); bg(s6); hdr(s6,"DETAILED RECOMMENDATIONS","F87171"); foot(s6);
        s6.addText("High Priority Workstreams", { x:0.5, y:0.52, w:12, h:0.55, fontSize:22, color:WH, fontFace:"Calibri", bold:true });
        s6.addText(`The table below shows ${critN} Critical and ${highN} High priority workstreams to improve NIST maturity and protect ${client}.`, { x:0.5, y:1.12, w:12.33, h:0.38, fontSize:11, color:TM, fontFace:"Calibri" });
        const h6Hdr=[mkCell("Ref","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Priority","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Subcategory","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Recommended Action","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Detail","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Effort","1E3A6B",WH,{bold:true,fontSize:9})];
        const h6Rows=[h6Hdr,...critHighGaps.map(({cat,domain,q,sc,rec},i)=>{
          const fill=i%2===0?CARD:CARD2;
          const pc=rec?.priority==="Critical"?"F87171":"FCD34D";
          return [mkCell(`${rec?.priority==="Critical"?"C":"H"}-${String(i+1).padStart(2,"0")}`,fill,CY,{fontSize:9,bold:true}),mkCell(rec?.priority||"—",fill,pc,{fontSize:9,bold:true}),mkCell(domain.id,fill,cat.color.replace("#",""),{fontSize:9,bold:true}),mkCell(rec?.action||q.slice(0,70),fill,WH,{fontSize:9}),mkCell(rec?.detail||"—",fill,TM,{fontSize:8}),mkCell(rec?.effort||"—",fill,TM,{fontSize:9})];
        })];
        s6.addTable(h6Rows,{ x:0.5, y:1.55, w:12.33, colW:[0.65,0.95,1.2,3.5,4.6,1.43], border:{ pt:0.4, color:BD } });
      }

      // ── SLIDE 7 — Detailed Recommendations: Medium ────────────────────
      const medGaps = gaps.filter(g=>g.rec?.priority==="Medium");
      if(medGaps.length>0) {
        const s7 = prs.addSlide(); bg(s7); hdr(s7,"DETAILED RECOMMENDATIONS","FCD34D"); foot(s7);
        s7.addText("Medium Priority Workstreams", { x:0.5, y:0.52, w:12, h:0.55, fontSize:22, color:WH, fontFace:"Calibri", bold:true });
        s7.addText(`The table below shows ${medN} Medium priority workstreams to improve NIST maturity and protect ${client}.`, { x:0.5, y:1.12, w:12.33, h:0.38, fontSize:11, color:TM, fontFace:"Calibri" });
        const m7Hdr=[mkCell("Ref","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Subcategory","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Recommended Action","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Detail","1E3A6B",WH,{bold:true,fontSize:9}),mkCell("Effort","1E3A6B",WH,{bold:true,fontSize:9})];
        const m7Rows=[m7Hdr,...medGaps.map(({cat,domain,q,sc,rec},i)=>{
          const fill=i%2===0?CARD:CARD2;
          return [mkCell(`M-${String(i+1).padStart(2,"0")}`,fill,CY,{fontSize:9,bold:true}),mkCell(domain.id+" — "+domain.name.slice(0,28),fill,cat.color.replace("#",""),{fontSize:9,bold:true}),mkCell(rec?.action||q.slice(0,70),fill,WH,{fontSize:9}),mkCell(rec?.detail||"—",fill,TM,{fontSize:8}),mkCell(rec?.effort||"—",fill,TM,{fontSize:9})];
        })];
        s7.addTable(m7Rows,{ x:0.5, y:1.55, w:12.33, colW:[0.65,2.3,3.5,4.55,1.33], border:{ pt:0.4, color:BD } });
      }

      // ── SLIDE 8 — Conclusion ──────────────────────────────────────────
      const s8 = prs.addSlide(); bg(s8);
      s8.addShape(prs.ShapeType.rect, { x:0, y:0, w:0.38, h:7.5, fill:{ color:CY }, line:{ color:CY, width:0 } });
      s8.addText("CONCLUSION", { x:0.6, y:0.38, w:8, h:0.26, fontSize:8, color:CY, fontFace:"Calibri", bold:true, charSpacing:5 });
      s8.addText(client, { x:0.6, y:0.68, w:11, h:0.62, fontSize:24, color:WH, fontFace:"Calibri", bold:true });
      s8.addText(`Following a detailed assessment of ${client} against the NIST Cybersecurity Framework (CSF) 2.0, ${asses} has identified a current profile score of ${overall?parseFloat(overall).toFixed(2):"TBC"} (${tierStr(overall)}).`, { x:0.6, y:1.38, w:12.1, h:0.5, fontSize:11, color:TM, fontFace:"Calibri" });
      s8.addText(`Current: ${overall?parseFloat(overall).toFixed(2):"TBC"} (${tierStr(overall)})   →   Target: ${overallTarget?parseFloat(overallTarget).toFixed(2):"TBC"} (${tierStr(overallTarget)})`, { x:0.6, y:2.0, w:10, h:0.45, fontSize:16, color:scoreCol(overall), fontFace:"Calibri", bold:true });
      const strongAreas = fw.filter(cat=>{ const sc=catScore(cat); return sc&&parseFloat(sc)>=3; }).map(cat=>cat.id+" — "+cat.name).slice(0,3);
      const improveAreas = fw.filter(cat=>{ const sc=catScore(cat); return sc&&parseFloat(sc)<2; }).map(cat=>cat.id+" — "+cat.name).concat(gaps.filter(g=>g.rec?.priority==="Critical").slice(0,3).map(g=>g.rec?.action||g.domain.name)).slice(0,5);
      if(strongAreas.length>0) { s8.addText("What "+client+" does well:", { x:0.6, y:2.6, w:5.8, h:0.32, fontSize:11, color:LI, fontFace:"Calibri", bold:true }); strongAreas.forEach((a,i)=>s8.addText("• "+a, { x:0.6, y:2.95+i*0.38, w:5.8, h:0.35, fontSize:10, color:WH, fontFace:"Calibri" })); }
      if(improveAreas.length>0) { s8.addText("Where "+client+" could improve:", { x:7.0, y:2.6, w:5.8, h:0.32, fontSize:11, color:"F87171", fontFace:"Calibri", bold:true }); improveAreas.forEach((a,i)=>s8.addText("• "+a, { x:7.0, y:2.95+i*0.38, w:5.8, h:0.35, fontSize:10, color:WH, fontFace:"Calibri" })); }
      s8.addText(`${asses} recommends ${critN+highN} High/Critical and ${medN} Medium priority workstreams. If implemented, ${client} should reach the target profile of ${overallTarget?parseFloat(overallTarget).toFixed(2):"the agreed target"}.`, { x:0.6, y:5.5, w:12.1, h:0.6, fontSize:11, color:TM, fontFace:"Calibri", italic:true });
      foot(s8);

      // ── SLIDE 9 — Appendix: NIST CSF 2.0 Overview ────────────────────
      const s9 = prs.addSlide(); bg(s9); hdr(s9,"APPENDIX 4 — NIST CSF OVERVIEW",TD); foot(s9);
      s9.addText("NIST CSF 2.0 — Explained", { x:0.5, y:0.52, w:12, h:0.55, fontSize:22, color:WH, fontFace:"Calibri", bold:true });
      s9.addText("The NIST CSF 2.0 framework scores across 6 Function Areas, 22 Categories and 106 Subcategories. Each subcategory is assessed and assigned an implementation tier from 0 to 4.", { x:0.5, y:1.12, w:12.33, h:0.5, fontSize:11, color:TM, fontFace:"Calibri" });
      const apHdr=[mkCell("Tier","1E3A6B",WH,{bold:true,fontSize:10}),mkCell("Label","1E3A6B",WH,{bold:true,fontSize:10}),mkCell("Description","1E3A6B",WH,{bold:true,fontSize:10})];
      const apRows=[apHdr,...[
        [0,"Not Present","Cybersecurity risk management is not applied. No practices, processes or policies exist.","F87171"],
        [1,"Partial","Risk management is ad hoc and reactive. Limited awareness at organisational level.","FB923C"],
        [2,"Risk-Informed","Management-approved risk practices exist but may not be implemented organisation-wide.","FCD34D"],
        [3,"Repeatable","Formally approved practices are consistently implemented across the organisation.","C8F135"],
        [4,"Adaptive","Continuously improved practices based on lessons learned and predictive indicators.","00BFFF"],
      ].map(([v,label,desc,col],i)=>[mkCell(String(v),i%2===0?CARD:CARD2,col,{bold:true,fontSize:14}),mkCell(label,i%2===0?CARD:CARD2,col,{bold:true,fontSize:11}),mkCell(desc,i%2===0?CARD:CARD2,WH,{fontSize:10})])];
      s9.addTable(apRows,{ x:0.5, y:1.7, w:12.33, colW:[0.7,2.2,9.43], border:{ pt:0.4, color:BD } });
      s9.addText("Function Summary:", { x:0.5, y:5.7, w:4, h:0.28, fontSize:10, color:TM, fontFace:"Calibri", bold:true });
      fw.forEach((cat,i) => s9.addText(`${cat.id}: ${cat.domains.length} categories, ${cat.domains.reduce((a,d)=>a+d.questions.length,0)} subcategories`, { x:0.5+(i%3)*4.11, y:6.05+Math.floor(i/3)*0.34, w:4.0, h:0.3, fontSize:9, color:TM, fontFace:"Calibri" }));

      await prs.writeFile({ fileName:`${client.replace(/\s+/g,"-")}-NIST-Assessment-${new Date().toISOString().slice(0,10)}.pptx` });
      flash("Report downloaded ✓");
    } catch(e) {
      console.error(e);
      flash("Error: run npm install pptxgenjs in your project terminal");
    }
    setGeneratingReport(false);
  }

  // Insight data
  const effortBreakdown = ["Low","Medium","High"].map(e=>({ label:e, value:getAllGaps().filter(g=>g.rec?.effort===e).length, color:EFFORT_CFG[e].color }));
  const scoreDist = [0,1,2,3,4].map(v=>({ label:String(v), value:Object.values(scores).filter(sc=>sc===v).length, color:ML.find(m=>m.value===v)?.color||"#9CA3AF" }));
  const gapsByCat = fw.map(cat=>({ label:cat.id, value:getAllGaps().filter(g=>g.cat.id===cat.id).length, color:cat.color }));
  const priSegments = ["Critical","High","Medium"].map(p=>({ label:p, value:getAllGaps().filter(g=>g.rec?.priority===p).length, color:PRI_CFG[p].color }));
  const totalGaps = priSegments.reduce((a,s)=>a+s.value,0);
  const avgByCat = fw.map(cat=>({ label:cat.id, value:catScore(cat)?parseFloat(catScore(cat)):0, color:getMC(catScore(cat)) }));

  return (
    <div style={{ minHeight:"100vh", background:"#08111F", fontFamily:"'Outfit','Segoe UI',sans-serif", color:"#E2EAF4" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <input type="file" accept=".json" ref={fileInputRef} onChange={loadSession} style={{display:"none"}}/>

      {/* ── Header ── */}
      <div style={{ background:"#060E1A", padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", height:"62px", borderBottom:"1px solid #1B3A6B", boxShadow:"0 2px 20px rgba(0,0,0,0.5)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          {/* LevelBlue logo mark — three diagonal stripes */}
          <div style={{ width:"36px", height:"36px", borderRadius:"8px", background:"#0D1F3C", border:"1px solid #1B3A6B", display:"flex", alignItems:"center", justifyContent:"center", gap:"3px", padding:"7px", overflow:"hidden" }}>
            <div style={{ display:"flex", gap:"3px", transform:"skewX(-12deg)" }}>
              <div style={{ width:"5px", height:"18px", background:"#1E6FD9", borderRadius:"1px" }}/>
              <div style={{ width:"5px", height:"18px", background:"#00BFFF", borderRadius:"1px" }}/>
              <div style={{ width:"5px", height:"18px", background:"#C8F135", borderRadius:"1px" }}/>
            </div>
          </div>
          <div>
            <div style={{ color:"#FFFFFF", fontWeight:"800", fontSize:"14px", letterSpacing:"-0.01em" }}>LevelBlue</div>
            <div style={{ color:"#4A6A8A", fontSize:"10px", fontWeight:"600", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:"-1px" }}>Cyber Maturity Assessment Scorecard</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:"3px", background:"rgba(13,31,60,0.8)", padding:"4px", borderRadius:"6px", border:"1px solid #1B3A6B" }}>
          {[
            {v:"setup",    label:"01 Setup"},
            {v:"workshop", label:"02 Workshop"},
            {v:"score",    label:"03 Score"},
            {v:"results",  label:"04 Results"},
          ].map(({v,label})=><button key={v} onClick={()=>setView(v)} style={navBtn(view===v)}>{label}</button>)}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <div style={{ width:"60px", height:"4px", background:"#1B3A6B", borderRadius:"3px", overflow:"hidden" }}>
              <div style={{ width:`${completion}%`, height:"100%", background:"linear-gradient(90deg,#1E6FD9,#00BFFF)", borderRadius:"3px", transition:"width 0.3s" }}/>
            </div>
            <span style={{ fontSize:"11px", color:"#4A6A8A" }}>{completion}%</span>
          </div>
          <button onClick={saveSession} style={{ padding:"5px 12px", borderRadius:"5px", border:"1px solid #1B3A6B", background:"#0D1F3C", color:statusMsg.includes("saved")?"#C8F135":"#8BAAC8", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>
            Save JSON ↓
          </button>
          <button onClick={()=>fileInputRef.current?.click()} style={{ padding:"5px 12px", borderRadius:"5px", border:"1px solid #1B3A6B", background:"#0D1F3C", color:statusMsg.includes("loaded")?"#C8F135":"#8BAAC8", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>
            Load JSON ↑
          </button>
          <button onClick={exportExcel} style={{ padding:"5px 12px", borderRadius:"5px", border:"1px solid rgba(200,241,53,0.4)", background:"rgba(200,241,53,0.1)", color:"#C8F135", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>
            Excel ↓
          </button>
          {isNIST && (
            <button onClick={exportPPTXReport} disabled={generatingReport} style={{ padding:"5px 12px", borderRadius:"5px", border:"1px solid rgba(0,191,255,0.4)", background:"rgba(0,191,255,0.1)", color:"#00BFFF", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit", opacity:generatingReport?0.6:1 }}>
              {generatingReport ? "Building…" : "Report ↓"}
            </button>
          )}
          {statusMsg && <span style={{ fontSize:"11px", color:"#C8F135", fontWeight:"600" }}>{statusMsg}</span>}
        </div>
      </div>

      <div style={{ maxWidth:"1140px", margin:"0 auto", padding:"26px 22px" }}>

        {/* ── Recovery banner ── */}
        {recoveryAvailable && (
          <div style={{ marginBottom:"18px", padding:"14px 18px", borderRadius:"10px", background:"rgba(252,211,77,0.1)", border:"1px solid rgba(252,211,77,0.35)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px" }}>
            <div>
              <div style={{ fontSize:"13px", fontWeight:"700", color:"#FCD34D", marginBottom:"3px" }}>⚡ Unsaved session detected</div>
              <div style={{ fontSize:"12px", color:"#8BAAC8" }}>A previous session was interrupted before a JSON save. You can restore it or dismiss it.</div>
            </div>
            <div style={{ display:"flex", gap:"8px", flexShrink:0 }}>
              <button onClick={restoreRecovery} style={{ padding:"7px 16px", borderRadius:"6px", background:"rgba(252,211,77,0.2)", border:"1px solid rgba(252,211,77,0.5)", color:"#FCD34D", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>Restore session</button>
              <button onClick={dismissRecovery} style={{ padding:"7px 14px", borderRadius:"6px", background:"transparent", border:"1px solid #1B3A6B", color:"#4A6A8A", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* ── SETUP ── */}
        {view==="setup" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px" }}>
            <div style={card}>
              <div style={{ fontSize:"11px", fontWeight:"700", color:"#4A6A8A", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"16px" }}>Engagement Details</div>
              {[{label:"Client Name",val:clientName,set:setClientName,ph:"e.g. Acme Pharma Ltd"},{label:"Assessor",val:assessor,set:setAssessor,ph:"Your name"},{label:"Sector",val:clientSector,set:setClientSector,ph:"e.g. Pharmaceuticals, Financial Services"}].map(({label,val,set,ph})=>(
                <div key={label} style={{ marginBottom:"13px" }}>
                  <label style={{ fontSize:"12px", fontWeight:"600", color:"#8BAAC8", display:"block", marginBottom:"5px" }}>{label}</label>
                  <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={{ width:"100%", padding:"9px 12px", borderRadius:"7px", border:"1px solid #1B3A6B", fontSize:"13px", fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:"#0A1932", color:"#E2EAF4" }}/>
                </div>
              ))}
              <div style={{ marginBottom:"13px" }}>
                <label style={{ fontSize:"12px", fontWeight:"600", color:"#8BAAC8", display:"block", marginBottom:"5px" }}>Business Context <span style={{color:"#4A6A8A",fontWeight:"400"}}>(for report)</span></label>
                <textarea value={clientContext} onChange={e=>setClientContext(e.target.value)} placeholder="Brief description of the organisation, key technology context, engagement background..." style={{ width:"100%", padding:"9px 12px", borderRadius:"7px", border:"1px solid #1B3A6B", fontSize:"12px", fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:"#0A1932", color:"#E2EAF4", minHeight:"70px", resize:"vertical", lineHeight:"1.5" }}/>
              </div>
              <div style={{ marginTop:"16px", padding:"12px 14px", borderRadius:"8px", background:"rgba(200,241,53,0.08)", border:"1px solid rgba(200,241,53,0.25)" }}>
                <div style={{ fontSize:"12px", fontWeight:"700", color:"#C8F135", marginBottom:"4px" }}>Session persistence</div>
                <div style={{ fontSize:"11px", color:"#8BAAC8", lineHeight:"1.5" }}>Use <strong style={{color:"#C8F135"}}>Save JSON</strong> to download your progress at any time. Upload it with <strong style={{color:"#C8F135"}}>Load JSON</strong> in any future session to resume exactly where you left off. Scores, notes and workshop notes all persist.</div>
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize:"11px", fontWeight:"700", color:"#4A6A8A", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"16px" }}>Select Framework</div>
              {Object.keys(FRAMEWORKS).map(f=>(
                <button key={f} onClick={()=>{ setFramework(f); setScores({}); setNotes({}); setWorkshopNotes({}); }} style={{ width:"100%", padding:"14px 16px", borderRadius:"9px", border:`2px solid ${framework===f?"#1E6FD9":"#1B3A6B"}`, background:framework===f?"rgba(30,111,217,0.15)":"#0A1932", marginBottom:"10px", textAlign:"left", cursor:"pointer", fontFamily:"inherit" }}>
                  <div style={{ fontWeight:"700", fontSize:"14px", color:framework===f?"#00BFFF":"#E2EAF4" }}>{f}</div>
                  <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"3px" }}>{f==="NIST CSF 2.0"?"6 functions · 22 categories · 106 subcategories · 0–4 NIST tiers":"3 groups · 18 controls · Implementation groups"}</div>
                </button>
              ))}
              <button onClick={()=>setView("workshop")} style={{ width:"100%", padding:"13px", borderRadius:"9px", background:"linear-gradient(135deg,#1E6FD9,#0EA5E9)", color:"white", border:"none", fontWeight:"700", fontSize:"13px", cursor:"pointer", fontFamily:"inherit", marginTop:"4px" }}>Begin Workshop →</button>
            </div>
            <div style={{ ...card, gridColumn:"1 / -1" }}>
              <div style={{ fontSize:"11px", fontWeight:"700", color:"#4A6A8A", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"14px" }}>NIST CSF 2.0 — Scoring Tiers (0–4)</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px" }}>
                {ML.map(m=>(
                  <div key={m.value} style={{ padding:"12px", borderRadius:"8px", background:m.bg, border:`1px solid ${m.color}40` }}>
                    <div style={{ fontWeight:"800", fontSize:"24px", color:m.color }}>{m.value}</div>
                    <div style={{ fontWeight:"700", fontSize:"12px", color:"#E2EAF4", marginTop:"3px" }}>{m.label}</div>
                    <div style={{ fontSize:"11px", color:"#8BAAC8", marginTop:"3px", lineHeight:"1.4" }}>{ML_DESC[m.value]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── WORKSHOP ── */}
        {view==="workshop" && (
          <div>
            <div style={{ marginBottom:"18px", padding:"14px 18px", borderRadius:"10px", background:"rgba(0,191,255,0.08)", border:"1px solid rgba(0,191,255,0.2)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:"14px", fontWeight:"700", color:"#00BFFF", marginBottom:"3px" }}>Workshop Mode — Discovery &amp; Evidence Capture</div>
                <div style={{ fontSize:"12px", color:"#8BAAC8" }}>Use this screen in the client session. Ask the questions, capture responses and evidence notes. Scoring happens after the workshop.</div>
              </div>
              <button onClick={()=>setView("score")} style={{ padding:"8px 18px", borderRadius:"7px", background:"linear-gradient(135deg,#1E6FD9,#0EA5E9)", color:"#FFFFFF", border:"none", fontWeight:"700", fontSize:"12px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>Move to Scoring →</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:"18px" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {fw.map(cat=>{
                  const wCaptured = cat.domains.filter(d=>workshopNotes[d.id]&&workshopNotes[d.id].trim()).length;
                  return (
                    <button key={cat.id} onClick={()=>setActiveSection(cat.id===activeSection?null:cat.id)} style={{ padding:"11px 13px", borderRadius:"9px", textAlign:"left", border:`2px solid ${activeSection===cat.id?cat.color:"#1B3A6B"}`, background:activeSection===cat.id?cat.light:"#0A1932", cursor:"pointer", fontFamily:"inherit" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.08em" }}>{cat.id}</span>
                        {wCaptured>0&&<span style={{ fontSize:"10px", color:"#C8F135", background:"rgba(200,241,53,0.15)", padding:"1px 6px", borderRadius:"3px" }}>{wCaptured} noted</span>}
                      </div>
                      <div style={{ fontSize:"12px", fontWeight:"700", color:"#E2EAF4", marginTop:"2px" }}>{cat.name}</div>
                    </button>
                  );
                })}
                <div style={{ ...card, marginTop:"6px", padding:"13px" }}>
                  <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"4px", fontWeight:"600" }}>NOTES CAPTURED</div>
                  <div style={{ fontSize:"24px", fontWeight:"800", color:"#00BFFF" }}>{fw.flatMap(c=>c.domains).filter(d=>workshopNotes[d.id]&&workshopNotes[d.id].trim()).length}</div>
                  <div style={{ fontSize:"11px", color:"#8BAAC8" }}>of {fw.flatMap(c=>c.domains).length} categories</div>
                </div>
              </div>

              <div>
                {!activeSection && (
                  <div style={{ ...card, textAlign:"center", padding:"56px" }}>
                    <div style={{ fontSize:"34px", marginBottom:"12px" }}>←</div>
                    <div style={{ fontSize:"15px", fontWeight:"700", color:"#E2EAF4" }}>Select a function to start</div>
                    <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"6px" }}>Run through each category, ask the questions, capture what the client tells you</div>
                  </div>
                )}
                {activeSection && (()=>{
                  const cat = fw.find(c=>c.id===activeSection); if(!cat) return null;
                  return (
                    <div>
                      <div style={{ ...card, marginBottom:"13px", borderLeft:`4px solid ${cat.color}` }}>
                        <div style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.1em", textTransform:"uppercase" }}>{cat.id} — {cat.name}</div>
                        <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"2px" }}>{cat.description}</div>
                      </div>
                      {cat.domains.map(domain => {
                        const isOpen = expandedDomains[domain.id] !== false;
                        const wqs = WORKSHOP_QS[domain.id] || [];
                        const hasNotes = workshopNotes[domain.id]?.trim();
                        return (
                          <div key={domain.id} style={{ ...card, marginBottom:"10px", borderLeft: hasNotes?`3px solid #C8F135`:"3px solid transparent" }}>
                            <button onClick={()=>setExpandedDomains(p=>({...p,[domain.id]:!isOpen}))} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0, display:"flex", justifyContent:"space-between", alignItems:"center", fontFamily:"inherit" }}>
                              <div>
                                <span style={{ fontSize:"11px", fontWeight:"700", color:cat.color, letterSpacing:"0.08em" }}>{domain.id}</span>
                                <span style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginLeft:"9px" }}>{domain.name}</span>
                                <span style={{ fontSize:"10px", color:"#4A6A8A", marginLeft:"8px" }}>({wqs.length} questions)</span>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                                {hasNotes && <span style={{ fontSize:"10px", color:"#C8F135", fontWeight:"700" }}>✓ Notes</span>}
                                <span style={{ color:"#4A6A8A", fontSize:"11px" }}>{isOpen?"▲":"▼"}</span>
                              </div>
                            </button>
                            {isOpen && (
                              <div style={{ marginTop:"14px", borderTop:"1px solid #1B3A6B", paddingTop:"14px" }}>
                                {wqs.length > 0 && (
                                  <div style={{ marginBottom:"16px" }}>
                                    <div style={{ fontSize:"11px", fontWeight:"700", color:"#00BFFF", marginBottom:"10px", letterSpacing:"0.05em", textTransform:"uppercase" }}>Discovery Questions</div>
                                    {wqs.map((q,i) => (
                                      <div key={i} style={{ display:"flex", gap:"10px", marginBottom:"12px", alignItems:"flex-start", padding:"10px 12px", background:"rgba(0,191,255,0.05)", borderRadius:"7px", border:"1px solid rgba(0,191,255,0.12)" }}>
                                        <span style={{ fontSize:"12px", fontWeight:"800", color:"#00BFFF", minWidth:"22px", marginTop:"1px", flexShrink:0 }}>{i+1}.</span>
                                        <span style={{ fontSize:"13px", color:"#E2EAF4", lineHeight:"1.6" }}>{q}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ fontSize:"11px", fontWeight:"700", color:"#00BFFF", marginBottom:"7px", letterSpacing:"0.05em", textTransform:"uppercase" }}>Evidence &amp; Workshop Notes</div>
                                <textarea
                                  value={workshopNotes[domain.id]||""}
                                  onChange={e=>setWorkshopNotes(p=>({...p,[domain.id]:e.target.value}))}
                                  placeholder={`Capture client responses, examples and context for ${domain.name}. These notes will be visible alongside each subcategory when you move to scoring.`}
                                  style={{ width:"100%", minHeight:"110px", padding:"10px 12px", borderRadius:"7px", border:`1px solid ${hasNotes?"rgba(200,241,53,0.35)":"#1B3A6B"}`, fontSize:"12px", fontFamily:"inherit", outline:"none", background:"#0A1932", color:"#E2EAF4", boxSizing:"border-box", lineHeight:"1.6", resize:"vertical" }}
                                />
                                {/* Evidence notes per subcategory — lightweight capture during workshop */}
                                <div style={{ marginTop:"12px" }}>
                                  <div style={{ fontSize:"11px", fontWeight:"700", color:"#4A6A8A", marginBottom:"8px", letterSpacing:"0.05em", textTransform:"uppercase" }}>Quick Evidence Notes — per subcategory (optional)</div>
                                  {domain.questions.map((q,qi) => {
                                    const key = `${domain.id}_q${qi}`;
                                    const [subId,...rest] = q.split(" — ");
                                    return (
                                      <div key={qi} style={{ marginBottom:"8px" }}>
                                        <div style={{ fontSize:"10px", fontWeight:"700", color:cat.color, marginBottom:"3px" }}>{subId}</div>
                                        <input
                                          placeholder={rest.join(" — ") || q}
                                          value={notes[key]||""}
                                          onChange={e=>setNotes(p=>({...p,[key]:e.target.value}))}
                                          style={{ width:"100%", padding:"6px 10px", borderRadius:"5px", border:"1px solid #1B3A6B", fontSize:"11px", fontFamily:"inherit", outline:"none", background:"#0A1932", color:"#E2EAF4", boxSizing:"border-box" }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── SCORE ── */}
        {view==="score" && (
          <div>
            <div style={{ marginBottom:"18px", padding:"14px 18px", borderRadius:"10px", background:"rgba(200,241,53,0.07)", border:"1px solid rgba(200,241,53,0.25)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:"14px", fontWeight:"700", color:"#C8F135", marginBottom:"3px" }}>Scoring Mode — Post-Workshop Assessment</div>
                <div style={{ fontSize:"12px", color:"#8BAAC8" }}>Score each subcategory 0–4 using workshop notes and document evidence. Set a target score alongside the current score. Save JSON regularly.</div>
              </div>
              <div style={{ display:"flex", gap:"8px", flexShrink:0 }}>
                <button onClick={saveSession} style={{ padding:"8px 16px", borderRadius:"7px", background:"rgba(200,241,53,0.15)", border:"1px solid rgba(200,241,53,0.4)", color:"#C8F135", fontWeight:"700", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>Save JSON ↓</button>
                <button onClick={()=>setView("results")} style={{ padding:"8px 16px", borderRadius:"7px", background:"rgba(0,191,255,0.12)", border:"1px solid rgba(0,191,255,0.3)", color:"#00BFFF", fontWeight:"700", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>View Results →</button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:"18px" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {fw.map(cat=>{
                  const sc = catScore(cat);
                  const scoredCount = cat.domains.flatMap(d=>d.questions.map((_,qi)=>scores[`${d.id}_q${qi}`])).filter(v=>v!==undefined).length;
                  const totalCount = cat.domains.flatMap(d=>d.questions).length;
                  return (
                    <button key={cat.id} onClick={()=>setActiveSection(cat.id===activeSection?null:cat.id)} style={{ padding:"11px 13px", borderRadius:"9px", textAlign:"left", border:`2px solid ${activeSection===cat.id?cat.color:"#1B3A6B"}`, background:activeSection===cat.id?cat.light:"#0A1932", cursor:"pointer", fontFamily:"inherit" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.08em" }}>{cat.id}</span>
                        {sc && <span style={{ fontSize:"13px", fontWeight:"800", color:getMC(sc) }}>{sc}</span>}
                      </div>
                      <div style={{ fontSize:"12px", fontWeight:"700", color:"#E2EAF4", marginTop:"2px" }}>{cat.name}</div>
                      <div style={{ height:"3px", background:"#1B3A6B", borderRadius:"2px", marginTop:"6px", overflow:"hidden" }}>
                        <div style={{ width:`${(scoredCount/totalCount)*100}%`, height:"100%", background:cat.color, opacity:0.7 }}/>
                      </div>
                    </button>
                  );
                })}
                <div style={{ ...card, marginTop:"6px", padding:"13px" }}>
                  <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"5px", fontWeight:"600" }}>OVERALL</div>
                  <div style={{ fontSize:"26px", fontWeight:"800", color:getMC(overall) }}>{overall||"—"}</div>
                  <div style={{ fontSize:"11px", color:"#8BAAC8" }}>{getML(overall)}</div>
                  {overallTarget && overall && (
                    <div style={{ fontSize:"10px", color:"#00BFFF", marginTop:"3px" }}>Target: {overallTarget}</div>
                  )}
                  <div style={{ fontSize:"10px", color:"#4A6A8A", marginTop:"3px" }}>{completion}% scored</div>
                </div>
              </div>

              <div>
                {!activeSection && (
                  <div style={{ ...card, textAlign:"center", padding:"56px" }}>
                    <div style={{ fontSize:"34px", marginBottom:"12px" }}>←</div>
                    <div style={{ fontSize:"15px", fontWeight:"700", color:"#E2EAF4" }}>Select a function to score</div>
                    <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"6px" }}>Workshop notes from Step 2 appear above each subcategory to inform your scoring</div>
                  </div>
                )}
                {activeSection && (()=>{
                  const cat = fw.find(c=>c.id===activeSection); if(!cat) return null;
                  return (
                    <div>
                      <div style={{ ...card, marginBottom:"13px", borderLeft:`4px solid ${cat.color}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div>
                            <div style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.1em", textTransform:"uppercase" }}>{cat.id} — {cat.name}</div>
                            <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"2px" }}>{cat.description}</div>
                          </div>
                          {catScore(cat) && <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"22px", fontWeight:"800", color:getMC(catScore(cat)) }}>{catScore(cat)}</div>
                            <div style={{ fontSize:"11px", color:"#8BAAC8" }}>{getML(catScore(cat))}</div>
                          </div>}
                        </div>
                      </div>

                      {cat.domains.map(domain => {
                        const isOpen = expandedDomains[domain.id] !== false;
                        const ds = domainScore(domain);
                        const dt = domainTarget(domain);
                        const wNote = workshopNotes[domain.id];
                        return (
                          <div key={domain.id} style={{ ...card, marginBottom:"10px" }}>
                            <button onClick={()=>setExpandedDomains(p=>({...p,[domain.id]:!isOpen}))} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0, display:"flex", justifyContent:"space-between", alignItems:"center", fontFamily:"inherit" }}>
                              <div>
                                <span style={{ fontSize:"11px", fontWeight:"700", color:cat.color, letterSpacing:"0.08em" }}>{domain.id}</span>
                                <span style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginLeft:"9px" }}>{domain.name}</span>
                                <span style={{ fontSize:"10px", color:"#4A6A8A", marginLeft:"8px" }}>({domain.questions.length} subcategories)</span>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                                {ds && <span style={{ fontSize:"14px", fontWeight:"800", color:getMC(ds) }}>{ds}{dt&&dt!==ds?<span style={{ fontSize:"11px", color:"#00BFFF" }}> → {dt}</span>:null}</span>}
                                <span style={{ color:"#4A6A8A", fontSize:"11px" }}>{isOpen?"▲":"▼"}</span>
                              </div>
                            </button>

                            {isOpen && (
                              <div style={{ marginTop:"14px", borderTop:"1px solid #1B3A6B", paddingTop:"14px" }}>
                                {/* Workshop notes from Step 2 — visible here to inform scoring */}
                                {wNote && (
                                  <div style={{ marginBottom:"16px", padding:"12px 14px", borderRadius:"8px", background:"rgba(200,241,53,0.06)", border:"1px solid rgba(200,241,53,0.2)" }}>
                                    <div style={{ fontSize:"10px", fontWeight:"700", color:"#C8F135", marginBottom:"5px", letterSpacing:"0.06em", textTransform:"uppercase" }}>Workshop Notes</div>
                                    <div style={{ fontSize:"12px", color:"#8BAAC8", lineHeight:"1.6", whiteSpace:"pre-wrap" }}>{wNote}</div>
                                  </div>
                                )}

                                {domain.questions.map((q, qi) => {
                                  const key = `${domain.id}_q${qi}`;
                                  const cur = scores[key];
                                  const [subId, ...rest] = q.split(" — ");
                                  const qText = rest.join(" — ") || q;
                                  return (
                                    <div key={qi} style={{ marginBottom:"18px", paddingBottom:"18px", borderBottom: qi<domain.questions.length-1?"1px solid #0D1F3C":"none" }}>
                                      <div style={{ display:"flex", gap:"8px", marginBottom:"8px", alignItems:"flex-start" }}>
                                        {isNIST && <span style={{ fontSize:"10px", fontWeight:"800", color:cat.color, whiteSpace:"nowrap", marginTop:"2px", background:cat.light, padding:"2px 6px", borderRadius:"4px", flexShrink:0 }}>{subId}</span>}
                                        <span style={{ fontSize:"13px", color:"#E2EAF4", lineHeight:"1.5", fontWeight:"500" }}>{isNIST ? qText : q}</span>
                                      </div>

                                      {/* Evidence note from workshop — shown above scoring if captured */}
                                      {notes[key] && (
                                        <div style={{ marginBottom:"8px", padding:"7px 10px", borderRadius:"5px", background:"rgba(0,191,255,0.06)", border:"1px solid rgba(0,191,255,0.15)", fontSize:"11px", color:"#8BAAC8", fontStyle:"italic" }}>
                                          📝 {notes[key]}
                                        </div>
                                      )}

                                      {/* Current score */}
                                      <div style={{ marginBottom:"6px" }}>
                                        <div style={{ fontSize:"10px", fontWeight:"700", color:"#4A6A8A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"5px" }}>Current Score</div>
                                        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", alignItems:"center" }}>
                                          <button onClick={()=>setScores(p=>({...p,[key]:-1}))} style={{ padding:"5px 11px", borderRadius:"5px", border:`2px solid ${cur===-1?"#4A6A8A":"#1B3A6B"}`, background:cur===-1?"rgba(74,106,138,0.3)":"#0A1932", color:cur===-1?"#8BAAC8":"#4A6A8A", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>N/A</button>
                                          {ML.map(m=>(
                                            <button key={m.value} onClick={()=>setScores(p=>({...p,[key]:m.value}))} style={{ padding:"5px 11px", borderRadius:"5px", border:`2px solid ${cur===m.value?m.color:"#1B3A6B"}`, background:cur===m.value?m.bg:"#0A1932", color:cur===m.value?m.color:"#4A6A8A", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>{m.value}</button>
                                          ))}
                                          {cur!==-1&&cur!==undefined&&<span style={{ fontSize:"11px", color:"#8BAAC8", marginLeft:"4px" }}>{ML.find(m=>m.value===cur)?.label}</span>}
                                          {cur===-1&&<span style={{ fontSize:"11px", color:"#4A6A8A", marginLeft:"4px" }}>N/A — excluded</span>}
                                        </div>
                                      </div>

                                      {/* Target score */}
                                      {isNIST && (
                                        <div style={{ marginBottom:"8px" }}>
                                          <div style={{ fontSize:"10px", fontWeight:"700", color:"#00BFFF", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"5px" }}>Target Score</div>
                                          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", alignItems:"center" }}>
                                            <button onClick={()=>setTargetScores(p=>({...p,[key]:-1}))} style={{ padding:"5px 11px", borderRadius:"5px", border:`2px solid ${targetScores[key]===-1?"#4A6A8A":"#1B3A6B"}`, background:targetScores[key]===-1?"rgba(74,106,138,0.2)":"transparent", color:targetScores[key]===-1?"#8BAAC8":"#4A6A8A", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>N/A</button>
                                            {ML.map(m=>{ const tgt=targetScores[key]; return (
                                              <button key={m.value} onClick={()=>setTargetScores(p=>({...p,[key]:m.value}))} style={{ padding:"5px 11px", borderRadius:"5px", border:`2px solid ${tgt===m.value?"#00BFFF":"#1B3A6B"}`, background:tgt===m.value?"rgba(0,191,255,0.15)":"transparent", color:tgt===m.value?"#00BFFF":"#4A6A8A", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>{m.value}</button>
                                            );})}
                                            {targetScores[key]!==undefined&&targetScores[key]!==-1&&<span style={{ fontSize:"11px", color:"#00BFFF", marginLeft:"4px" }}>{ML.find(m=>m.value===targetScores[key])?.label}</span>}
                                            {targetScores[key]===undefined&&cur!==undefined&&cur!==-1&&<span style={{ fontSize:"10px", color:"#4A6A8A", marginLeft:"4px", fontStyle:"italic" }}>defaults to current ({cur})</span>}
                                          </div>
                                        </div>
                                      )}

                                      {/* Evidence note field */}
                                      <input
                                        placeholder="Evidence note — document references, verbatim quotes, observations..."
                                        value={notes[key]||""}
                                        onChange={e=>setNotes(p=>({...p,[key]:e.target.value}))}
                                        style={{ width:"100%", padding:"7px 10px", borderRadius:"6px", border:"1px solid #1B3A6B", fontSize:"12px", fontFamily:"inherit", outline:"none", background:"#0A1932", color:"#E2EAF4", boxSizing:"border-box" }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
          <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:"18px" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {fw.map(cat=>{
                const sc=catScore(cat);
                return (
                  <button key={cat.id} onClick={()=>setActiveSection(cat.id===activeSection?null:cat.id)} style={{ padding:"11px 13px", borderRadius:"9px", textAlign:"left", border:`2px solid ${activeSection===cat.id?cat.color:"#1B3A6B"}`, background:activeSection===cat.id?cat.light:"#0A1932", cursor:"pointer", fontFamily:"inherit" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.08em" }}>{cat.id}</span>
                      {sc&&<span style={{ fontSize:"13px", fontWeight:"800", color:getMC(sc) }}>{sc}</span>}
                    </div>
                    <div style={{ fontSize:"12px", fontWeight:"700", color:"#E2EAF4", marginTop:"2px" }}>{cat.name}</div>
                  </button>
                );
              })}
              <div style={{ ...card, marginTop:"6px", padding:"13px" }}>
                <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"5px", fontWeight:"600" }}>OVERALL</div>
                <div style={{ fontSize:"28px", fontWeight:"800", color:getMC(overall) }}>{overall||"—"}</div>
                <div style={{ fontSize:"11px", color:"#8BAAC8" }}>{getML(overall)}</div>
                <div style={{ fontSize:"10px", color:"#4A6A8A", marginTop:"3px" }}>{completion}% done</div>
              </div>
            </div>

            <div>
              {!activeSection && (
                <div style={{ ...card, textAlign:"center", padding:"56px" }}>
                  <div style={{ fontSize:"34px", marginBottom:"12px" }}>←</div>
                  <div style={{ fontSize:"15px", fontWeight:"700", color:"#E2EAF4" }}>Select a function to begin</div>
                  <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"6px" }}>Each domain includes workshop questions and evidence capture</div>
                </div>
              )}

              {activeSection && (()=>{
                const cat=fw.find(c=>c.id===activeSection);
                if(!cat) return null;
                return (
                  <div>
                    <div style={{ ...card, marginBottom:"13px", borderLeft:`4px solid ${cat.color}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <div style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.1em", textTransform:"uppercase" }}>{cat.id} — {cat.name}</div>
                          <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"2px" }}>{cat.description}</div>
                        </div>
                        {catScore(cat)&&<div style={{ textAlign:"right" }}><div style={{ fontSize:"24px", fontWeight:"800", color:getMC(catScore(cat)) }}>{catScore(cat)}</div><div style={{ fontSize:"11px", color:"#8BAAC8" }}>{getML(catScore(cat))}</div></div>}
                      </div>
                    </div>

                    {cat.domains.map(domain=>{
                      const isOpen=expandedDomains[domain.id]!==false;
                      const ds=domainScore(domain);
                      const wqs=WORKSHOP_QS[domain.id]||[];
                      const wOpen=showWorkshop[domain.id];
                      return (
                        <div key={domain.id} style={{ ...card, marginBottom:"10px" }}>
                          {/* Domain header */}
                          <button onClick={()=>setExpandedDomains(p=>({...p,[domain.id]:!isOpen}))} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0, display:"flex", justifyContent:"space-between", alignItems:"center", fontFamily:"inherit" }}>
                            <div><span style={{ fontSize:"11px", fontWeight:"700", color:cat.color, letterSpacing:"0.08em" }}>{domain.id}</span><span style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginLeft:"9px" }}>{domain.name}</span></div>
                            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                              {ds&&<span style={{ fontSize:"15px", fontWeight:"800", color:getMC(ds) }}>{ds}</span>}
                              <span style={{ color:"#4A6A8A", fontSize:"11px" }}>{isOpen?"▲":"▼"}</span>
                            </div>
                          </button>

                          {isOpen && (
                            <div style={{ marginTop:"14px", borderTop:"1px solid #1B3A6B", paddingTop:"14px" }}>

                              {/* Workshop Questions Toggle */}
                              {wqs.length>0 && (
                                <div style={{ marginBottom:"16px" }}>
                                  <button onClick={()=>setShowWorkshop(p=>({...p,[domain.id]:!wOpen}))} style={{ display:"flex", alignItems:"center", gap:"8px", background:"rgba(0,191,255,0.08)", border:"1px solid rgba(0,191,255,0.25)", borderRadius:"7px", padding:"8px 12px", cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
                                    <span style={{ fontSize:"13px" }}>💬</span>
                                    <span style={{ fontSize:"12px", fontWeight:"700", color:"#00BFFF" }}>Workshop Questions ({wqs.length})</span>
                                    <span style={{ fontSize:"11px", color:"#4A6A8A", marginLeft:"auto" }}>{wOpen?"Hide":"Show"}</span>
                                  </button>
                                  {wOpen && (
                                    <div style={{ marginTop:"8px", padding:"14px", background:"rgba(0,191,255,0.06)", borderRadius:"8px", border:"1px solid rgba(0,191,255,0.2)" }}>
                                      <div style={{ marginBottom:"10px" }}>
                                        {wqs.map((q,i)=>(
                                          <div key={i} style={{ display:"flex", gap:"10px", marginBottom:"8px", alignItems:"flex-start" }}>
                                            <span style={{ fontSize:"11px", fontWeight:"800", color:"#00BFFF", minWidth:"18px", marginTop:"1px" }}>{i+1}.</span>
                                            <span style={{ fontSize:"12px", color:"#8BAAC8", lineHeight:"1.6" }}>{q}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div>
                                        <div style={{ fontSize:"11px", fontWeight:"700", color:"#00BFFF", marginBottom:"5px" }}>Workshop Notes for {domain.name}</div>
                                        <textarea
                                          value={workshopNotes[domain.id]||""}
                                          onChange={e=>setWorkshopNotes(p=>({...p,[domain.id]:e.target.value}))}
                                          placeholder="Capture client responses, observations and context from the workshop discussion..."
                                          style={{ width:"100%", minHeight:"90px", padding:"8px 10px", borderRadius:"6px", border:"1px solid rgba(0,191,255,0.25)", fontSize:"12px", fontFamily:"inherit", outline:"none", background:"#0A1932", color:"#E2EAF4", boxSizing:"border-box", lineHeight:"1.5", resize:"vertical" }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Control Questions */}
                              {domain.questions.map((q,qi)=>{
                                const key=`${domain.id}_q${qi}`;
                                const cur=scores[key];
                                return (
                                  <div key={qi} style={{ marginBottom:"16px", paddingBottom:"16px", borderBottom:qi<domain.questions.length-1?"1px solid #0D1F3C":"none" }}>
                                    <div style={{ fontSize:"13px", color:"#E2EAF4", marginBottom:"8px", lineHeight:"1.5", fontWeight:"500" }}>{q}</div>
                                    {/* Current score row */}
                                    <div style={{ marginBottom:"6px" }}>
                                      <div style={{ fontSize:"10px", fontWeight:"700", color:"#4A6A8A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"5px" }}>Current</div>
                                      <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", alignItems:"center" }}>
                                        <button onClick={()=>setScores(p=>({...p,[key]:-1}))} style={{ padding:"4px 9px", borderRadius:"5px", border:`2px solid ${cur===-1?"#4A6A8A":"#1B3A6B"}`, background:cur===-1?"rgba(74,106,138,0.3)":"#0A1932", color:cur===-1?"#8BAAC8":"#4A6A8A", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>N/A</button>
                                        {ML.map(m=>(
                                          <button key={m.value} onClick={()=>setScores(p=>({...p,[key]:m.value}))} style={{ padding:"4px 9px", borderRadius:"5px", border:`2px solid ${cur===m.value?m.color:"#1B3A6B"}`, background:cur===m.value?m.bg:"#0A1932", color:cur===m.value?m.color:"#4A6A8A", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>{m.value}</button>
                                        ))}
                                        {cur!==-1&&cur!==undefined&&<span style={{ fontSize:"11px", color:"#8BAAC8", marginLeft:"4px" }}>{ML.find(m=>m.value===cur)?.label}</span>}
                                        {cur===-1&&<span style={{ fontSize:"11px", color:"#4A6A8A", marginLeft:"4px" }}>N/A — excluded</span>}
                                      </div>
                                    </div>
                                    {/* Target score row */}
                                    {isNIST && (
                                      <div style={{ marginBottom:"7px" }}>
                                        <div style={{ fontSize:"10px", fontWeight:"700", color:"#00BFFF", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"5px" }}>Target</div>
                                        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", alignItems:"center" }}>
                                          <button onClick={()=>setTargetScores(p=>({...p,[key]:-1}))} style={{ padding:"4px 9px", borderRadius:"5px", border:`2px solid ${targetScores[key]===-1?"#4A6A8A":"#1B3A6B"}`, background:targetScores[key]===-1?"rgba(74,106,138,0.2)":"transparent", color:targetScores[key]===-1?"#8BAAC8":"#4A6A8A", fontSize:"11px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>N/A</button>
                                          {ML.map(m=>{ const tgt=targetScores[key]; return (
                                            <button key={m.value} onClick={()=>setTargetScores(p=>({...p,[key]:m.value}))} style={{ padding:"4px 9px", borderRadius:"5px", border:`2px solid ${tgt===m.value?"#00BFFF":"#1B3A6B"}`, background:tgt===m.value?"rgba(0,191,255,0.15)":"transparent", color:tgt===m.value?"#00BFFF":"#4A6A8A", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>{m.value}</button>
                                          );})}
                                          {targetScores[key]!==undefined&&targetScores[key]!==-1&&<span style={{ fontSize:"11px", color:"#00BFFF", marginLeft:"4px" }}>{ML.find(m=>m.value===targetScores[key])?.label}</span>}
                                          {targetScores[key]===undefined&&cur!==undefined&&cur!==-1&&<span style={{ fontSize:"10px", color:"#4A6A8A", marginLeft:"4px", fontStyle:"italic" }}>defaults to current ({cur})</span>}
                                        </div>
                                      </div>
                                    )}
                                    <input placeholder="Evidence note (optional)" value={notes[key]||""} onChange={e=>setNotes(p=>({...p,[key]:e.target.value}))} style={{ width:"100%", padding:"7px 10px", borderRadius:"6px", border:"1px solid #1B3A6B", fontSize:"12px", fontFamily:"inherit", outline:"none", background:"#0A1932", color:"#E2EAF4", boxSizing:"border-box" }}/>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {view==="results" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
              <div>
                <div style={{ fontSize:"18px", fontWeight:"800", color:"#FFFFFF" }}>{clientName||"Client"} — Maturity Results</div>
                <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"2px" }}>{framework} · {assessor||"Assessor"} · {new Date().toLocaleDateString("en-GB")}{isNIST?" · Scale: 0–4 NIST Tiers":""}</div>
              </div>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={exportExcel} style={{ padding:"9px 18px", borderRadius:"8px", border:"1px solid rgba(200,241,53,0.4)", background:"rgba(200,241,53,0.1)", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit", color:"#C8F135" }}>Export Excel ↓</button>
                {isNIST && <button onClick={exportPPTXReport} disabled={generatingReport} style={{ padding:"9px 18px", borderRadius:"8px", border:"1px solid rgba(0,191,255,0.4)", background:"rgba(0,191,255,0.1)", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit", color:"#00BFFF", opacity:generatingReport?0.6:1 }}>{generatingReport?"Building…":"Generate Report ↓"}</button>}
              </div>
            </div>

            <div style={{ display:"flex", gap:"3px", marginBottom:"18px", background:"#0A1932", padding:"4px", borderRadius:"8px", width:"fit-content", border:"1px solid #1B3A6B" }}>
              {["overview","insights","recommendations","workshop"].map(t=>(
                <button key={t} onClick={()=>setResultsTab(t)} style={{ padding:"7px 16px", borderRadius:"6px", border:"none", background:resultsTab===t?"#1B3A6B":"transparent", color:resultsTab===t?"#FFFFFF":"#4A6A8A", fontSize:"12px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>
                  {t==="overview"?"Scorecard":t==="insights"?"Insights":t==="recommendations"?`Recommendations${getAllGaps().length>0?` (${getAllGaps().length})`:""}` :"Workshop Notes"}
                </button>
              ))}
            </div>

            {/* SCORECARD OVERVIEW */}
            {resultsTab==="overview" && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px", marginBottom:"18px" }}>
                  <div style={card}>
                    <div style={{ fontSize:"11px", fontWeight:"700", color:"#4A6A8A", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"14px" }}>Overall Maturity — Current vs Target</div>
                    <div style={{ display:"flex", alignItems:"center", gap:"18px", marginBottom:"16px" }}>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"4px", fontWeight:"600" }}>CURRENT</div>
                        <div style={{ width:"88px", height:"88px", borderRadius:"50%", background:`conic-gradient(${getMC(overall)} ${(parseFloat(overall||0)/4)*360}deg, #1B3A6B 0deg)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#0D1F3C", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                            <div style={{ fontSize:"20px", fontWeight:"800", color:getMC(overall), lineHeight:1 }}>{overall||"—"}</div>
                            <div style={{ fontSize:"9px", color:"#4A6A8A", fontWeight:"600" }}>/4.0</div>
                          </div>
                        </div>
                        <div style={{ fontSize:"11px", fontWeight:"700", color:getMC(overall), marginTop:"5px" }}>{getML(overall)}</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                        <div style={{ fontSize:"20px", color:"#1B3A6B" }}>→</div>
                        {overall&&overallTarget&&<div style={{ fontSize:"11px", fontWeight:"800", color:"#C8F135", background:"rgba(200,241,53,0.1)", padding:"2px 8px", borderRadius:"4px" }}>+{(parseFloat(overallTarget)-parseFloat(overall)).toFixed(2)}</div>}
                      </div>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:"11px", color:"#00BFFF", marginBottom:"4px", fontWeight:"600" }}>TARGET</div>
                        <div style={{ width:"88px", height:"88px", borderRadius:"50%", background:`conic-gradient(#00BFFF ${(parseFloat(overallTarget||0)/4)*360}deg, #1B3A6B 0deg)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#0D1F3C", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                            <div style={{ fontSize:"20px", fontWeight:"800", color:"#00BFFF", lineHeight:1 }}>{overallTarget||"—"}</div>
                            <div style={{ fontSize:"9px", color:"#4A6A8A", fontWeight:"600" }}>/4.0</div>
                          </div>
                        </div>
                        <div style={{ fontSize:"11px", fontWeight:"700", color:"#00BFFF", marginTop:"5px" }}>{getML(overallTarget)}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
                      {fw.map(cat=>{ const sc=catScore(cat); const tgt=catTarget(cat); const pctC=sc?(parseFloat(sc)/4)*100:0; const pctT=tgt?(parseFloat(tgt)/4)*100:0; return (
                        <div key={cat.id}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                            <span style={{ fontSize:"11px", fontWeight:"600", color:"#8BAAC8" }}>{cat.id} — {cat.name}</span>
                            <span style={{ fontSize:"11px", fontWeight:"800", color:getMC(sc) }}>{sc||"—"}{tgt&&tgt!==sc?<span style={{ color:"#00BFFF", marginLeft:"4px" }}>→ {tgt}</span>:null}</span>
                          </div>
                          <div style={{ height:"6px", background:"#1B3A6B", borderRadius:"3px", overflow:"hidden", position:"relative" }}>
                            {pctT>0&&<div style={{ position:"absolute", left:0, width:`${pctT}%`, height:"100%", background:"rgba(0,191,255,0.25)", borderRadius:"3px" }}/>}
                            <div style={{ position:"absolute", left:0, width:`${pctC}%`, height:"100%", background:getMC(sc), borderRadius:"3px", transition:"width 0.5s" }}/>
                          </div>
                        </div>
                      );})}
                    </div>
                    <div style={{ marginTop:"12px", display:"flex", gap:"12px", fontSize:"10px", color:"#4A6A8A" }}>
                      <span style={{ display:"flex", alignItems:"center", gap:"4px" }}><span style={{ width:"10px", height:"4px", background:"#1E6FD9", borderRadius:"2px", display:"inline-block" }}/> Current</span>
                      <span style={{ display:"flex", alignItems:"center", gap:"4px" }}><span style={{ width:"10px", height:"4px", background:"rgba(0,191,255,0.25)", borderRadius:"2px", display:"inline-block" }}/> Target</span>
                    </div>
                  </div>
                  <div style={{ ...card, display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <div style={{ fontSize:"11px", fontWeight:"700", color:"#4A6A8A", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"8px", alignSelf:"flex-start" }}>Radar View</div>
                    <RadarChart scores={radarScores} framework={framework}/>
                  </div>
                </div>
                {fw.map(cat=>(
                  <div key={cat.id} style={{ ...card, marginBottom:"10px", borderLeft:`4px solid ${cat.color}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                      <div><span style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.1em" }}>{cat.id}</span><span style={{ fontSize:"14px", fontWeight:"800", color:"#FFFFFF", marginLeft:"9px" }}>{cat.name}</span></div>
                      <div style={{ textAlign:"right" }}><span style={{ fontSize:"19px", fontWeight:"800", color:getMC(catScore(cat)) }}>{catScore(cat)||"—"}</span><div style={{ fontSize:"11px", color:"#8BAAC8" }}>{getML(catScore(cat))}</div></div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))", gap:"8px" }}>
                      {cat.domains.map(domain=>{ const ds=domainScore(domain); const dt=domainTarget(domain); return (
                        <div key={domain.id} style={{ padding:"10px 12px", borderRadius:"8px", background:"#0A1932", border:"1px solid #1B3A6B" }}>
                          <div style={{ fontSize:"10px", fontWeight:"700", color:cat.color, letterSpacing:"0.08em" }}>{domain.id}</div>
                          <div style={{ fontSize:"11px", fontWeight:"700", color:"#E2EAF4", marginTop:"2px" }}>{domain.name}</div>
                          <div style={{ display:"flex", alignItems:"baseline", gap:"6px", marginTop:"5px" }}>
                            <span style={{ fontSize:"20px", fontWeight:"800", color:getMC(ds) }}>{ds||"—"}</span>
                            {dt&&dt!==ds&&<span style={{ fontSize:"12px", color:"#00BFFF" }}>→ {dt}</span>}
                          </div>
                          <div style={{ fontSize:"10px", color:"#8BAAC8" }}>{getML(ds)}{dt&&dt!==ds?<span style={{ color:"#00BFFF" }}> · Target: {getML(dt)}</span>:null}</div>
                        </div>
                      );})}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* INSIGHTS */}
            {resultsTab==="insights" && (
              completion<10?(
                <div style={{ ...card, textAlign:"center", padding:"56px" }}>
                  <div style={{ fontSize:"30px", marginBottom:"12px" }}>📊</div>
                  <div style={{ fontSize:"15px", fontWeight:"700", color:"#E2EAF4" }}>Score more controls to unlock insights</div>
                  <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"7px" }}>At least 10% completion needed for meaningful analysis</div>
                </div>
              ):(
                <div>
                  {/* Row 1 — Score distribution + Avg by function */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"14px" }}>
                    <div style={card}>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginBottom:"3px" }}>Score Distribution</div>
                      <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"16px" }}>Number of controls at each maturity level</div>
                      <HBarChart data={[1,2,3,4,5].map(v=>({ label:ML.find(m=>m.value===v)?.label||String(v), value:Object.values(scores).filter(sc=>sc===v).length, color:ML.find(m=>m.value===v)?.color||"#9CA3AF" }))} />
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"14px", paddingTop:"12px", borderTop:"1px solid #1B3A6B" }}>
                        {[1,2,3,4,5].map(v=>{ const m=ML.find(x=>x.value===v); return (
                          <div key={v} style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                            <div style={{ width:"8px", height:"8px", borderRadius:"2px", background:m?.color, flexShrink:0 }}/>
                            <span style={{ fontSize:"10px", color:"#8BAAC8" }}>{v} — {m?.label}</span>
                          </div>
                        );})}
                      </div>
                    </div>
                    <div style={card}>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginBottom:"3px" }}>Average Score by Function</div>
                      <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"16px" }}>Maturity across each function — lower values indicate greatest need (max 5.0)</div>
                      <HBarChart data={fw.map(cat=>({ label:cat.id, value:catScore(cat)?parseFloat(catScore(cat)):0, color:getMC(catScore(cat)) }))} maxVal={5} />
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"14px", paddingTop:"12px", borderTop:"1px solid #1B3A6B" }}>
                        {fw.map(cat=>(
                          <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                            <div style={{ width:"8px", height:"8px", borderRadius:"2px", background:cat.color, flexShrink:0 }}/>
                            <span style={{ fontSize:"10px", color:"#8BAAC8" }}>{cat.id} — {cat.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 2 — Gaps by function + Priority breakdown */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"14px" }}>
                    <div style={card}>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginBottom:"3px" }}>Gaps by Function</div>
                      <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"16px" }}>Controls scoring below 3 per function — guides remediation workstream scoping</div>
                      <HBarChart data={fw.map(cat=>({ label:cat.id, value:getAllGaps().filter(g=>g.cat.id===cat.id).length, color:cat.color }))} />
                      {(()=>{ const worst=fw.map(cat=>({id:cat.id,name:cat.name,color:cat.color,n:getAllGaps().filter(g=>g.cat.id===cat.id).length})).sort((a,b)=>b.n-a.n)[0]; return worst?.n>0?(
                        <div style={{ marginTop:"12px", padding:"9px 12px", borderRadius:"6px", background:"rgba(0,0,0,0.2)", border:"1px solid #1B3A6B", fontSize:"11px", color:"#8BAAC8" }}>
                          <span style={{ fontWeight:"700", color:worst.color }}>{worst.id} — {worst.name}</span>{" "}has the most gaps ({worst.n} controls below threshold)
                        </div>
                      ):null; })()}
                    </div>
                    <div style={card}>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginBottom:"3px" }}>Gap Priority Breakdown</div>
                      <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"16px" }}>Urgency profile across all identified gaps</div>
                      {totalGaps===0?(
                        <div style={{ color:"#4A6A8A", fontSize:"12px", padding:"20px 0" }}>No gaps identified yet</div>
                      ):(
                        <>
                          <div style={{ display:"flex", alignItems:"center", gap:"20px", marginBottom:"16px" }}>
                            <div style={{ position:"relative", width:"110px", height:"110px", flexShrink:0 }}>
                              <DonutChart segments={priSegments} size={110} thickness={24}/>
                              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
                                <div style={{ fontSize:"22px", fontWeight:"800", color:"#FFFFFF", lineHeight:1 }}>{totalGaps}</div>
                                <div style={{ fontSize:"10px", color:"#4A6A8A", fontWeight:"600", marginTop:"2px" }}>total</div>
                              </div>
                            </div>
                            <div style={{ flex:1 }}>
                              {priSegments.map(seg=>(
                                <div key={seg.label} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                                  <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:seg.color, flexShrink:0 }}/>
                                  <span style={{ fontSize:"12px", color:"#E2EAF4", fontWeight:"600", flex:1 }}>{seg.label}</span>
                                  <span style={{ fontSize:"18px", fontWeight:"800", color:seg.color, minWidth:"26px", textAlign:"right" }}>{seg.value}</span>
                                  <span style={{ fontSize:"11px", color:"#4A6A8A", minWidth:"34px" }}>{totalGaps?Math.round((seg.value/totalGaps)*100):0}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ height:"8px", borderRadius:"4px", overflow:"hidden", display:"flex", gap:"2px" }}>
                            {priSegments.filter(s=>s.value>0).map(seg=>(
                              <div key={seg.label} style={{ flex:seg.value, background:seg.color, borderRadius:"4px" }}/>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row 3 — Effort profile */}
                  <div style={card}>
                    <div style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginBottom:"3px" }}>Remediation Effort Profile</div>
                    <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"16px" }}>Distribution of effort required to close all identified gaps — use for resource planning</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"12px" }}>
                      {effortBreakdown.map(e=>{ const cfg=EFFORT_CFG[e.label]; const pct=getAllGaps().length?Math.round((e.value/getAllGaps().length)*100):0; return (
                        <div key={e.label} style={{ padding:"16px", borderRadius:"9px", background:"rgba(0,0,0,0.2)", border:`1px solid ${cfg.color}40` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                            <div style={{ fontSize:"11px", fontWeight:"700", color:cfg.color, textTransform:"uppercase", letterSpacing:"0.08em" }}>{e.label} Effort</div>
                            <span style={{ fontSize:"11px", color:"#4A6A8A" }}>{pct}%</span>
                          </div>
                          <div style={{ fontSize:"30px", fontWeight:"800", color:cfg.color, lineHeight:1, marginBottom:"10px" }}>{e.value}</div>
                          <div style={{ height:"4px", background:"#1B3A6B", borderRadius:"2px", overflow:"hidden" }}>
                            <div style={{ width:`${pct}%`, height:"100%", background:cfg.color, borderRadius:"2px", transition:"width 0.5s" }}/>
                          </div>
                        </div>
                      );})}
                    </div>
                    {getAllGaps().filter(g=>g.rec?.effort==="Low").length>0&&(
                      <div style={{ padding:"11px 14px", borderRadius:"8px", background:"rgba(200,241,53,0.08)", border:"1px solid rgba(200,241,53,0.25)", fontSize:"12px", display:"flex", gap:"8px", alignItems:"flex-start" }}>
                        <span style={{ fontWeight:"800", color:"#C8F135", flexShrink:0 }}>Quick wins</span>
                        <span style={{ color:"#8BAAC8" }}>{getAllGaps().filter(g=>g.rec?.effort==="Low").length} gap{getAllGaps().filter(g=>g.rec?.effort==="Low").length>1?"s":""} can be addressed with low effort. Prioritise these first to demonstrate early progress to the client.</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {/* RECOMMENDATIONS */}
            {resultsTab==="recommendations" && (
              getAllGaps().length===0?(
                <div style={{ ...card, textAlign:"center", padding:"56px" }}>
                  <div style={{ fontSize:"30px", marginBottom:"12px" }}>✓</div>
                  <div style={{ fontSize:"15px", fontWeight:"700", color:"#E2EAF4" }}>No gaps below 3 identified yet</div>
                  <div style={{ fontSize:"12px", color:"#4A6A8A", marginTop:"7px" }}>Complete the assessment to see recommendations</div>
                </div>
              ):(
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"18px" }}>
                    {["Critical","High","Medium"].map(p=>{ const count=getAllGaps().filter(g=>g.rec?.priority===p).length; const cfg=PRI_CFG[p]; return (
                      <div key={p} style={{ ...card, borderLeft:`4px solid ${cfg.color}`, padding:"14px 16px" }}>
                        <div style={{ fontSize:"24px", fontWeight:"800", color:cfg.color }}>{count}</div>
                        <div style={{ fontSize:"12px", color:"#8BAAC8", marginTop:"3px", fontWeight:"600" }}>{p} Priority</div>
                      </div>
                    );})}
                  </div>
                  {["Critical","High","Medium"].map(priority=>{
                    const gaps=getAllGaps().filter(g=>g.rec?.priority===priority);
                    if(!gaps.length) return null;
                    const cfg=PRI_CFG[priority];
                    return (
                      <div key={priority} style={{ marginBottom:"20px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"9px" }}>
                          <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:cfg.color }}/>
                          <span style={{ fontSize:"13px", fontWeight:"800", color:"#FFFFFF" }}>{priority} Priority</span>
                          <span style={{ fontSize:"12px", color:"#4A6A8A" }}>— {gaps.length} finding{gaps.length>1?"s":""}</span>
                        </div>
                        {gaps.map(({cat,domain,q,sc,key,rec},idx)=>(
                          <div key={idx} style={{ ...card, marginBottom:"7px", borderLeft:`4px solid ${cat.color}`, padding:"16px 20px" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"9px" }}>
                              <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"4px", flexWrap:"wrap" }}>
                                  <span style={{ fontSize:"10px", fontWeight:"800", color:cat.color, letterSpacing:"0.08em" }}>{domain.id}</span>
                                  <span style={{ fontSize:"10px", color:"#4A6A8A" }}>·</span>
                                  <span style={{ fontSize:"11px", color:"#8BAAC8", fontWeight:"600" }}>{domain.name}</span>
                                </div>
                                <div style={{ fontSize:"13px", fontWeight:"600", color:"#E2EAF4", marginBottom:"3px" }}>{q}</div>
                                {notes[key]&&<div style={{ fontSize:"11px", color:"#8BAAC8", fontStyle:"italic" }}>"{notes[key]}"</div>}
                              </div>
                              <div style={{ padding:"3px 9px", borderRadius:"5px", background:ML.find(m=>m.value===sc)?.bg, fontWeight:"800", fontSize:"12px", color:getMC(sc), marginLeft:"12px", whiteSpace:"nowrap" }}>
                                {sc} — {ML.find(m=>m.value===sc)?.label}
                              </div>
                            </div>
                            {rec&&(
                              <div style={{ background:"#0A1932", borderRadius:"8px", padding:"12px 14px", border:"1px solid #1B3A6B" }}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
                                  <div style={{ fontSize:"13px", fontWeight:"700", color:"#00BFFF" }}>→ {rec.action}</div>
                                  <div style={{ display:"flex", gap:"5px", marginLeft:"10px", flexShrink:0 }}>
                                    {rec.priority&&<span style={tagSty(PRI_CFG[rec.priority])}>{rec.priority}</span>}
                                    {rec.effort&&<span style={tagSty(EFFORT_CFG[rec.effort])}>Effort: {rec.effort}</span>}
                                  </div>
                                </div>
                                <div style={{ fontSize:"12px", color:"#8BAAC8", lineHeight:"1.6", marginBottom:"6px" }}>{rec.detail}</div>
                                <div style={{ fontSize:"11px", color:"#4A6A8A", fontWeight:"600" }}>{rec.ref}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* WORKSHOP NOTES */}
            {resultsTab==="workshop" && (
              <div>
                <div style={{ marginBottom:"16px", padding:"12px 16px", borderRadius:"8px", background:"rgba(0,191,255,0.08)", border:"1px solid rgba(0,191,255,0.2)", fontSize:"12px", color:"#00BFFF" }}>
                  Workshop notes captured during the engagement. These are included in the Excel export on a dedicated sheet.
                </div>
                {fw.map(cat=>(
                  <div key={cat.id} style={{ ...card, marginBottom:"10px", borderLeft:`4px solid ${cat.color}` }}>
                    <div style={{ fontSize:"11px", fontWeight:"800", color:cat.color, letterSpacing:"0.1em", marginBottom:"12px" }}>{cat.id} — {cat.name}</div>
                    {cat.domains.map(domain=>{
                      const wqs=WORKSHOP_QS[domain.id]||[];
                      const wn=workshopNotes[domain.id];
                      return (
                        <div key={domain.id} style={{ marginBottom:"14px", paddingBottom:"14px", borderBottom:"1px solid #1B3A6B" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                            <div>
                              <span style={{ fontSize:"10px", fontWeight:"700", color:cat.color, letterSpacing:"0.08em" }}>{domain.id}</span>
                              <span style={{ fontSize:"13px", fontWeight:"700", color:"#E2EAF4", marginLeft:"8px" }}>{domain.name}</span>
                            </div>
                            {wn&&<span style={{ fontSize:"10px", color:"#C8F135", fontWeight:"700", background:"rgba(200,241,53,0.12)", padding:"2px 8px", borderRadius:"4px" }}>Notes captured</span>}
                          </div>
                          {wqs.length>0&&(
                            <div style={{ fontSize:"11px", color:"#4A6A8A", marginBottom:"8px" }}>
                              {wqs.slice(0,2).map((q,i)=><div key={i} style={{ marginBottom:"2px" }}>• {q}</div>)}
                              {wqs.length>2&&<div style={{ color:"#4A6A8A" }}>+ {wqs.length-2} more questions</div>}
                            </div>
                          )}
                          <textarea
                            value={workshopNotes[domain.id]||""}
                            onChange={e=>setWorkshopNotes(p=>({...p,[domain.id]:e.target.value}))}
                            placeholder="No notes captured yet — add them here or during the assessment..."
                            style={{ width:"100%", minHeight:"70px", padding:"8px 10px", borderRadius:"6px", border:"1px solid #1B3A6B", fontSize:"12px", fontFamily:"inherit", outline:"none", background:"#0A1932", color:"#E2EAF4", boxSizing:"border-box", lineHeight:"1.5", resize:"vertical" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
