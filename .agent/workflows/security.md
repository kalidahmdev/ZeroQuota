---
description: Comprehensive security audit and vulnerability scan.
---

# Security Audit Workflow

> [!IMPORTANT]
> This is a **READ-ONLY** audit workflow.
> **The ONLY allowed write operation is creating or updating the `Security_Audit.md` report.**
> You are FORBIDDEN from modifying source code or applying fixes during this workflow.

## Mandatory Agent Instructions

1.  **Read-Only Strictness**: Do NOT fix issues found. Only report them.
2.  **Tool Usage**: Use `grep_search`, `find_by_name`, `npm audit` to gather data.
3.  **Report Generation**: Compile all findings into `Security_Audit.md`.

## Workflow Phases

### Phase 1: Secrets & Sensitive Data Scan

// turbo

- `grep_search` for keywords: `API_KEY`, `SECRET`, `password`, `token`, `Bearer`, `private_key`, `AWS_ACCESS_KEY_ID`.
  - _Exclude_: `node_modules`, `.git`, `dist`, `build`.
- Check if `.env` file exists and if it is listed in `.gitignore`.
- Check for hardcoded IP addresses or `localhost` references in production code.

### Phase 2: Input Validation & Injection Risks

- Scan for raw SQL queries or string concatenation in database calls.
- Scan for usage of `eval()`, `setTimeout(string)`, or `setInterval(string)`.
- Scan for `dangerouslySetInnerHTML` (React) or `v-html` (Vue) usage.
- specific check: `grep_search` for `exec(`, `spawn(`, `system(` to identify potential command injection points.

### Phase 3: Network & CORS Configuration

- Audit CORS settings (search for `cors(`, `Access-Control-Allow-Origin`).
  - Flag `*` origins.
- Check for disabled SSL/TLS verification.
- Review middleware for security headers (Helmet, etc.).

### Phase 4: Authentication & Authorization

- Identify where tokens are stored (search for `localStorage.setItem`, `sessionStorage.setItem` with token-like keys).
- Check standard auth middleware usage on API routes.
- Verify explicit role checks on sensitive endpoints.

### Phase 5: Dependency Vulnerabilities

// turbo

- Run `npm audit --audit-level=high` (if `package.json` exists).
- flag any "Critical" or "High" severity issues.

### Phase 6: Report Generation

**ACTION**: Create or Overwrite `Security_Audit.md` with:

```markdown
# Security Audit Report

**Date**: [Current Date]
**Status**: [Pass / Fail / Warnings]

## 1. Secrets & Environment

- [ ] [Pass/Fail] .env in .gitignore
- [ ] [Pass/Fail] Hardcoded secrets validation

## 2. Injection & Input Safety

- [ ] Findings: ...

## 3. Network & Config

- [ ] Findings: ...

## 4. Auth & Data Protection

- [ ] Findings: ...

## 5. Dependency Audit

- [ ] High Severity Vulnerabilities: ...

## 6. Remediation Plan

- [List prioritized fixes]
```

## Conclusion

- Call `notify_user` with the content of `Security_Audit.md` or a summary.
- Ask if they want to proceed with a `/fix` workflow (if applicable) or manual remediation.
