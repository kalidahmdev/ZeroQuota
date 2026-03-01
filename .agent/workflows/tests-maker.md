---
description: Executes the test strategy. Installs recommended tools and generates test files based on tests-report.md.
---

# Enterprise Test Maker Workflow (EXECUTION)

> [!IMPORTANT]
> This is an ACTIVE EXECUTION workflow that WILL modify your project.
> **This workflow installs dependencies, creates config files, and writes test code.**
> PREREQUISITE: You MUST run `/tests-auditor` first to generate the `tests-report.md`.

## Mandatory Agent Instructions

1. **Dependency Check**: ALWAYS read `tests-report.md` at the start. Refuse to proceed if it does not exist.
2. **User Confirmation for Critical Actions**: Before running `npm install`, show the user the exact command and ask for confirmation.
3. **Incremental Execution**: Create one test file at a time. Run tests after each creation to ensure they compile.

## Phase 1: Read the Strategy

// turbo

1. **Load the Report**:
   - `view_file tests-report.md` to understand the mission.
   - Extract the following:
     - **Packages to Install**: List of `npm install` commands.
     - **Config Files to Create**: List of config files.
     - **Priority Test Files**: List of test files to generate.

2. **Validation**:
   - If `tests-report.md` does not exist, REFUSE and state: "The tests-report.md file does not exist. Please run `/tests-auditor` first to generate the report."

## Phase 2: Environment Setup

1. **Check Existing Tools**:
   // turbo
   - `view_file package.json` to see if test tools are already installed.
   - If `vitest`, `jest`, `playwright`, etc. are already present, skip installation for that tool.

2. **Install Missing Tools**:
   - For EACH missing tool identified in the report:
     - Show the user the exact install command.
     - Run the command (e.g., `npm install -D vitest @testing-library/react`).
   - For Playwright, if selected, also run `npx playwright install`.

3. **Create Config Files**:
   - BASED ON the "Recommended Action Plan" in `tests-report.md`:
     - **If Vitest is recommended**: Create `vitest.config.ts` and `vitest.setup.ts` using modern ESM best practices and `@testing-library/jest-dom`.
     - **If Jest is recommended**: Create `jest.config.js` or `jest.config.ts` with appropriate transforms (like `ts-jest` or `babel-jest`).
     - **If Playwright is recommended**: Create `playwright.config.ts` with a robust multi-browser setup and `webServer` configuration.
   - **Constraint**: Do NOT use generic templates. Generate configurations that are specifically optimized for the detected project type (e.g., Next.js vs Vite).

4. **Update package.json Scripts**:
   - Add or update the `test` script to `vitest` or `jest` as appropriate.
   - Add `test:e2e` script for `playwright test`.

## Phase 3: Test Generation

For EACH file in the "Priority Test Files" list from `tests-report.md`:

1. **Read Source File**:
   // turbo
   - `view_file [source_file_path]` to understand the functions and exports.

2. **Generate Test File**:
   - Create the corresponding `.test.ts` or `.spec.ts` file.
   - Use the "Arrange, Act, Assert" pattern.
   - For React components, use `@testing-library/react`.
   - For utility functions, test edge cases (null, empty, error states).

3. **Verify Test Runs**:
   - After writing each test file, run `npm run test -- [test_file_path]` to ensure it compiles and executes (even if some tests fail initially).

## Phase 4: Verification & Report

1. **Run Full Test Suite**:
   // turbo
   - `npm run test` to run all unit/integration tests.
   - `npm run test:e2e` (if applicable) to run E2E tests.

2. **Report Results**:
   - Summarize total tests run, passed, failed.
   - List any tests that are failing and why.

3. **Notify User**:
   - Use `notify_user` to present the final summary and ask if further tests should be generated.
