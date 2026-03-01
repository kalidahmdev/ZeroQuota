---
description: Exhaustive enterprise-grade code audit. READ-ONLY analysis + Report Generation.
---

# Exhaustive Enterprise Code Review (READ-ONLY)

> [!IMPORTANT]
> This is a STRICT ANALYSIS workflow. You are FORBIDDEN from modifying any source code.
> **The ONLY allowed write operation is creating/updating the `Code_Review.md` report.**

## Mandatory Agent Instructions

1. **Source Code Lock**: You are strictly prohibited from using `replace_file_content`, `multi_replace_file_content`, or `write_to_file` on any file _except_ `Code_Review*.md` (e.g., `Code_Review_v2.md`).
2. **Refusal Policy**: If the user asks you to "fix", "apply", "go ahead", or any other variation of applying changes, you MUST refuse and state: "I'm currently in the Review Workflow and cannot make or apply any changes. I can only audit and report."
3. **Safe Tools Only**: You may freely use `grep_search`, `view_file`, `find_by_name`, `npm audit`, `tsc`, and `lint` to gather data.
4. **No File Alteration**: You are strictly prohibited from using `replace_file_content`, `multi_replace_file_content`, or `write_to_file` on any file _except_ `Code_Review*.md`.

## Phase 0: Context Gathering

1. **Understand Key Components**:
   - Read `README.md` or `project-spec.md` (if they exist) to understand the domain context.
   - Check `package.json` dependencies to identify the tech stack (e.g., Auth, Database).
   - Check `tsconfig.json` to understand the project structure.
   - Check `package-lock.json` or `yarn.lock` to understand the dependency tree.
   - **Verification**: Ensure `node_modules` exists (do NOT scan its contents).

## Phase 1: Full System Inventory

1. **Map the Territory**:
   // turbo
   - Run `find_by_name` (or `ls -R`) to list **ALL** files, excluding `node_modules` and build artifacts.
   - Verify complete list of source files (`.ts`, `.tsx`, `.js`, `.css`).

## Phase 2: Automated & Security Dragnet

1. **Security & Governance**:
   // turbo
   - Run `npm audit --audit-level=high`.
   - Run `grep_search` across **ALL** files for: "API_KEY", "SECRET", "password", "token".
   - **Environment Safety**: Check content of `.gitignore` to ensure `.env` is excluded. Scan for hardcoded IPs or `localhost`.
   - **PII Leakage**: Scan for potential PII patterns (emails/phones) in test data or constants.
   - **Git Integrity**: Search for `<<<<<<<` merge conflict markers.
   - **Onboarding Check**: Verify `.env.example` exists and matches `process.env` usage.
2. **Dependency Health**:
   - Run `npm outdated` to identify severely lagging packages.
   - Review `package.json` license fields for compliance (e.g., restricted GPL).
3. **Strict Health Integrity**:
   // turbo
   - Run `npx tsc --noEmit` (Capture ALL output).
   - Run `npm run lint` (Capture ALL output).
   - Run `npm run build` (Capture ALL output).
   - Run `npm run test` (Capture ALL output).
   - Run `npm run type-check` (Capture ALL output).

## Phase 3: The "Every Line" Analysis

1. **Systematic Review**:
   - Iterate through source files.
   - Search for:
     - **Code Smells**: `console.log`, `any`, `TODO`, `FIXME`, Unused Imports, commented-out code.
     - **Suppression Audit**: Count `@ts-ignore`, `@ts-nocheck`, and `eslint-disable`.
     - **Complexity**: Files > 300 lines, deep nesting.
     - **State Management**: Identify Prop Drilling (>3 layers) or Context Hell.
     - **Performance**: Missing dependency arrays, inline objects.
     - **Architecture**: Logic in UI components, circular dependencies.
     - **Reliability**: Empty `catch` blocks or swallowed errors.
     - **API Resilience**: Hardcoded fetch timeouts, missing network error handling.
     - **Localization (i18n)**: Hardcoded user-facing strings (English text in JSX).
     - **Accessibility**: Missing `aria-` labels or `alt` text on interactive elements.

## Phase 3.5: Standards & Assurance

1. **Testing Coverage**:
   - Check if critical components have corresponding `*.test.tsx` or `*.spec.ts` files.
   - Flag any complex utility file (> 50 lines) that lacks a test file.
2. **Accessibility (a11y)**:
   - Check for `onClick` on non-interactive elements (`div`, `span`) without role attributes.
   - Verify images utilize `alt` props.
3. **Infrastructure & Ops**:
   - **Docker**: Check for `latest` tags or missing `USER` instruction (root risk).
   - **CI/CD**: Audit `.github/workflows` for unpinned actions or hardcoded secrets.

## Phase 5: Automated Optimization Suggestions

1. **Bundle Analysis**:
   - Check for heavy dependencies (e.g., `moment` vs `date-fns`, `lodash` vs native).
   - Identify large static assets imported directly into code.
2. **React Performance**:
   - Flag anonymous functions passed as props to PureComponents (causes re-renders).
   - Identify Context Providers wrapping the entire app without split contexts.
3. **Database/API**:
   - Flag `SELECT *` patterns in SQL strings.
   - Identify waterfall requests (awaiting explicitly inside a loop).

## Phase 6: Report Generation

**ACTION**: Check if `Code_Review.md` exists.

- If **NO**: Create `Code_Review.md`.
- If **YES**: Create `Code_Review_v2.md` (or increment to v3, v4, etc. based on what exists).

Write the following report to the determined file:

```markdown
# Comprehensive Code Review Report

**Date**: [Current Date]
**Status**: [Production Ready / Needs Work / Critical Issues]

## 1. Executive Summary

[Summary of health, architecture, and maintainability]

## 2. Critical Issues (Must Fix)

- [ ] [File:Line] Description.

## 3. Architecture & Performance Analysis

[Deep dive]

## 4. Lint & Type Health

- **TypeScript**: [Summary]
- **Linting**: [Summary]

## 5. Refactoring Recommendations

- **[filename.tsx]**: [Insight]

## 6. Optimization Opportunities

- **[Bundle/Perf]**: [Suggestion]

## 7. Action Plan

[Prioritized next steps]
```
