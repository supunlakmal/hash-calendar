# Security Policy

## Supported versions

Security updates are applied to the `main` branch.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older snapshots/forks | No |

## Reporting a vulnerability

Please report security vulnerabilities privately.

- Preferred: GitHub Security Advisory
  - https://github.com/supunlakmal/hash-calendar/security/advisories/new
- If advisory reporting is unavailable, open a private contact request through GitHub profile channels.

Please do not post exploit details in public issues.

## What to include in a report

- Affected component(s)
- Reproduction steps or proof of concept
- Impact assessment (confidentiality/integrity/availability)
- Suggested mitigation (if known)

## Response process

- Initial triage target: within 7 days
- If confirmed, a fix will be prepared and coordinated for disclosure
- Credit will be given unless you request anonymity

## Scope notes for this project

`hash-calendar` is a client-only app with URL-hash state. Security-relevant areas include:

- Encryption/decryption behavior
- URL hash parsing/handling
- Data import parsing (`.ics`, JSON bridge)
- Third-party script loading and integration
