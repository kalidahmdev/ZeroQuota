# Security Policy

## Reporting a Vulnerability

We take the security of ZeroQuota seriously. If you discover a security vulnerability, please do NOT open a public issue. Instead, report it privately.

### How to report

Please send an email to [INSERT EMAIL] with:
- A description of the vulnerability.
- Steps to reproduce (if applicable).
- Potential impact.

We will acknowledge your report within 48 hours and provide a timeline for a fix.

## Security Guidelines

- **Never** hardcode secrets or API keys in the source code.
- Use environment variables for sensitive configuration.
- Regularly audit dependencies for known vulnerabilities (`npm audit`).
