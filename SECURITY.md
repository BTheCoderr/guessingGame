# Security Policy

## Supported version

Security fixes target the current default branch and the active production build when one exists.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose user data, credentials, private state, or privileged operations. Prefer GitHub private vulnerability reporting / Security Advisories when available, or contact the repository owner privately through GitHub.

Include the affected build, reproduction steps, impact, and sanitized evidence.

## Security-sensitive areas

Extra review is expected for changes touching:

- backup/import validation
- service-worker caching
- challenge-link parsing
- local persistence and restore flows

Never commit real secrets, private API keys, production service-role credentials, or user data.
