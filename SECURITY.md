# Security Policy

## Supported Versions

Only the latest major release branch of ZeroQuota receives active maintenance and security patches.

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

We take the security of ZeroQuota seriously. If you discover a security vulnerability, please do NOT open a public issue. Instead, report it privately.

### How to report

Please report vulnerabilities privately via either:
1. **GitHub Private Vulnerability Reporting**: Submit a private advisory via [GitHub Security Advisories](https://github.com/kalidahmdev/ZeroQuota/security/advisories/new).
2. **Email**: Send details directly to **kalidahmdev@gmail.com**.

When reporting, please include:
- A description of the vulnerability.
- Steps to reproduce (if applicable).
- Potential impact and affected versions/environments.

We will acknowledge your report within 48 hours and provide a timeline for a coordinated disclosure and fix.

## Security Guidelines

- **Never** hardcode secrets or API keys in the source code.
- Use environment variables or secure storage for sensitive configuration.
- Regularly audit dependencies for known vulnerabilities (`npm audit`).
