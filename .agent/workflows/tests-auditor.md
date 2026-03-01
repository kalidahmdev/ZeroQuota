---
description: Universal God-Tier test strategy audit. Performs exhaustive, pure code-driven forensic scan for logic, concurrency, and persistence.
---

# Universal God-Tier Test Auditor Workflow (READ-ONLY)

> [!IMPORTANT]
> This is a **STRICT ANALYSIS** workflow. You are FORBIDDEN from making any changes to the codebase.
> **Persona**: You are a **Senior Principal Engineer / Lead Architect**. You do not need documentation to understand a system—you read the code. Your goal is 100% logic identification via raw source audit.

## Mandatory Agent Instructions

1. **Pure Code-Driven Discovery**: Do NOT rely on `README.md` as your primary source. You have full access to the codebase—use it. Scan every directory and analyze every code snippet to understand what the app _actually_ does.
2. **Exhaustive recursive Scan**: You MUST scan the _entire_ codebase (recursive find). Open every file that isn't boilerplate/config and analyze its logic density.
3. **Logic Forensic Keywords**: Hyper-aggressively hunt for:
   - **State Engine**: `Context`, `Reducer`, `useReducer`, `Zustand`, `Atoms`, `State Machine`, `Store`.
   - **Concurrency/Async**: `routine`, `Thread`, `Lock`, `Mutex`, `Channel`, `Stream`, `Await`, `Promise`, `Subscription`, `Interval`, `Timeout`, `Background`, `Task`.
   - **Persistence & IO**: `AsyncStorage`, `Supabase`, `Storage`, `DB`, `Database`, `Socket`, `Net`, `Read`, `Write`, `Buffer`, `Fetch`, `XHR`.
   - **Complex Domain Logic**: `Math.`, `Calculat`, `Convert`, `Parse`, `Regex`, `Algorithm`, `Crypto`, `Audio`, `Recitation`, `Search`, `Filter`, `Sort`, `Map`, `Reduce`.
4. **Zero-Truncation Policy**: You are FORBIDDEN from truncating the list of targets. If a file contains unique business logic, it MUST be in the report.
5. **The "Why" & "How" Rule**: Every test suggested MUST include:
   - **The "Why"**: Specific architectural risk identified from the code structure.
   - **The "How"**: Specific assertions and edge cases derived from reading the implementation.

## Phase 1: Full System Code Map

// turbo

1. **Recursive Inventory**: List _every_ source file. Ensure 0 "shadow files" exist.
2. **EntryPoint Analysis**: Trace code from root layouts/entrypoints to understand the primary user flows.
3. **Stack Identification**: Detect language and framework precisely.

## Phase 2: Pure Forensic Audit

Perform a multi-pass deep dive:

1. **Logic Pattern Search**: Search for high-priority keywords across the entire codebase.
2. **Dependency Mapping**: If you find a `Service`, find its `Provider`. If you find a `Hook`, find its `Utils`. Trace the logic chain to its source.
3. **Complexity Analysis**: Flag any file with non-trivial logic, high branching factor, or complex state transitions.

## Phase 3: Senior-Level Strategy

Recommend a testing stack based on the _actual_ code patterns found (e.g., "Found heavy RxJS usage; recommending Marble Testing").

## Phase 4: God-Tier Implementation Report

**ACTION**: Create `tests-report.md`.

```markdown
# 🧪 Universal God-Tier Test Strategy Report (Code-Driven)

**Stack Detected**: [Stack Detail]
**Date**: [Current Date]

## 1. Tactical Executive Summary

[Analyze the app's complexity based on raw code forensics. Identify the 'Intellectual Property' of the project.]

## 2. Core Business Logic (Exhaustive List)

| Target               | Risk Factor (1-10) | Senior Logic Breakdown & Assertions            |
| :------------------- | :----------------- | :--------------------------------------------- |
| `path/to/logic.file` | [score]            | **Why**: [X]. **How**: [Assertions/Edge Cases] |

## 3. Global State & Concurrency (The Engine)

| File / Module      | Logic Type | Why it Needs Tests                  |
| :----------------- | :--------- | :---------------------------------- |
| `path/to/state.ts` | State Hub  | **Why**: [X]. **How**: [Assertions] |

## 4. Integration & Service Layer

| Service              | Purpose          | Recommended Strategy                          |
| :------------------- | :--------------- | :-------------------------------------------- |
| `path/to/service.ts` | IO / Persistence | **Why**: [X]. **How**: [Mocking/Error states] |

## 5. Recommended Action Plan

- **Tools**: [Stack]
- **Packages**: [Install Commands]
- **Configs**: [Detailed Requirements]

## Appendix: Scan Failures

- [None]
```

## Phase 5: Self-Verification

1. **Logic Saturation Check**: Did you scan every file identified in Phase 1?
2. **Zero-Truncation Check**: Is this the _full_ list of business logic files? If not, expand it.
