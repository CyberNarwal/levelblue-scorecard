# Security assessment - Northwind Trading

## Executive summary

Northwind Trading asked us to assess the security of its corporate network and
its customer-facing payment platform. We carried out the work between 3 and 21
August 2026. This report sets out what we found, how serious each finding is
and what we recommend doing about it.

The platform is in reasonable shape. Northwind patches its internet-facing
estate promptly and segments the cardholder data environment from the corporate
network. Two findings need attention before the next audit. Administrator
accounts do not require multi-factor authentication (MFA), and the backup
restoration process has not been tested since 2022.

## Scope and approach

We tested 42 internet-facing hosts, the payment platform and the Active
Directory forest that supports both. We worked from an unauthenticated position
for the external test and from a standard domain account for the internal test.
Physical security, social engineering and the retail estate were out of scope.

We assessed the environment against PCI DSS v4.0.1 and used CIS Controls v8.1
to structure the recommendations. Severity ratings follow CVSS v3.1.

## Findings

### Administrator accounts do not require MFA

Four of the six domain administrator accounts authenticate with a password
alone. An attacker who recovers one password gains full control of the forest.
We confirmed this during the internal test by authenticating as a service
administrator from an unmanaged laptop.

Severity: High (CVSS 8.1). This maps to PCI DSS requirement 8.4.

### Backup restoration is untested

Northwind takes nightly backups of the payment database and replicates them to
a second site. Nobody has restored one since March 2022. An untested backup is
an assumption rather than a control, and the recovery time objective of four
hours has never been demonstrated.

Severity: Medium (CVSS 5.3).

### Log4j remains unpatched on three hosts

Three internal application servers still run Log4j 2.14.1 and are vulnerable to
CVE-2021-44228. The hosts are not reachable from the internet, which limits the
exposure, but an attacker with a foothold on the corporate network could reach
them.

Severity: High (CVSS 7.5).

| Finding | Severity | Framework reference |
|---|---|---|
| Administrator accounts do not require MFA | High | PCI DSS 8.4 |
| Backup restoration is untested | Medium | CIS Control 11 |
| Log4j remains unpatched on three hosts | High | PCI DSS 6.3 |

## Recommendations

1. Enforce MFA on every administrative account, starting with the four domain
   administrators. Northwind can do this in Entra ID without new licensing.
2. Restore the payment database from backup in a test environment, record how
   long it takes and repeat the exercise every six months.
3. Upgrade Log4j to 2.17.1 or later on the three affected application servers.
4. Review the administrative account inventory each quarter and remove accounts
   that no longer need elevated rights.

We would be glad to retest the MFA and Log4j findings once the work is done.
