# Cyber Security Maturity Assessment

## Executive Summary

Northwind Trading Ltd engaged us to conduct an assessment of their cyber security
posture against the NIST Cybersecurity Framework v2.  The assessment was  carried
out between 4 March 2026 and 12 March 2026.

We identified 14 critical findings across the estate. The organisation's
overall maturity was assessed as Tier 2, and it is our view that the programme
may possibly benefit from a number of improvements in relation to identity
management.

It should be noted that the client's Azure AD tenancy was not in scope, and
several servers were not reachable at the time of testing. The breakdown of
findings by severity was 45% critical, 30% high and 20% medium.

## Key Findings

Our assessment identified 12 critical findings which are summarised below.

| Ref | Finding | Severity | CVSS |
|---|---|---|---|
| F-01 | Legacy SSL enabled on the perimeter | High | CVSS 9.8 |
| F-02 | Kerberoasting possible against service accounts | Critical | CVSS v3.1 9.1 |
| F-03 | No MFA on privileged accounts | Critical | |

### F-01 Legacy protocols

The perimeter load balancer accepts SSL v3 connections . This was identified
during the external review and effects all internet facing services. A
threat actor could intercept traffic from the malicious host 203.0.113.9 or
from 45.155.205.211, which is a known C2 endpoint.

The finding is rated as Severe and should be remediated. Credentials were
found in a configuration file: password = Summer2026!Trading and an access
key AKIAIOSFODNN7EXAMPLE was also present.

### F-02 Service account exposure

Service accounts are configured with weak passwords and no MFA.  This
represents a significant risk to the organisation. Many accounts are affected.

The organization should review these accounts. CVE-2026-1234 and cve-2021-44228
are both relevant here, and the Log4J issue in particular remains unpatched.
The relevant technique is T1558.3 under the MITRE Att&ck framework.

## Recommendations

- Implement multi factor authentication across all privileged accounts
- The organisation should consider reviewing its password policy
- Deploy EDR to all endpoints within 30 days
- Implementing network segmentation would reduce lateral movement
- Patching should be performed on a regular basis by the IT team

## Next Steps

TBC - awaiting confirmation from [CLIENT NAME] on the remediation timeline.

See Section 7.3 for the detailed control mapping and Figure 4 for the heat map.

Figure 1. Maturity by NIST CSF function

The assessment covered controls GV.OC-01, PR.AA-05 and DE.XX-02 across the estate.
Our review of ISO 27001 controls referenced A.9.2.3 throughout.
