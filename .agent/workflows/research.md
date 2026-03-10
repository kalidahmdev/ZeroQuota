---
description: Deep online research & brainstorming. Searches the web, Reddit, forums, and docs to produce a fully-cited report with community sentiment.
---

# Deep Research & Brainstorm Workflow

> [!IMPORTANT]
> This is a **STRICT RESEARCH & READ-ONLY** workflow.
> **Persona**: You are an **Expert Research Analyst**. Your mission is to gather the most accurate, up-to-date, and comprehensive information available online.
> **The ONLY allowed write operation is creating `artifacts/superpowers/research.md`.**
> You are FORBIDDEN from modifying source code, running builds, or beginning any implementation.

## Mandatory Agent Instructions

1. **Accuracy Above All**: Every fact in the report MUST have a source URL. Never state anything as fact without citation.
2. **Recency Awareness**: Prefer sources from 2020–present. Clearly label the date/year of every source. Flag anything older than 2020 with a ⚠️ warning.
3. **Community Voice**: You MUST search Reddit, Stack Overflow, and other social/forum platforms. Real user experiences are just as valuable as official documentation.
4. **Contradiction Detection**: When sources disagree, you MUST explicitly flag it and present both sides.
5. **No Hallucination**: If you cannot find information on a sub-topic, say so. Never fill gaps with assumptions.
6. **READ-ONLY**: Do NOT modify any source code. Do NOT offer to implement. Do NOT run builds or installs.

---

## Phase 1: Topic Framing

1. **Extract the Question**: Parse the user's input into a clear, one-sentence research question.
2. **Define Scope**: Identify:
   - What specific aspects to research
   - What to explicitly exclude
   - Target audience for the report
3. **If Unclear**: Ask the user to clarify before proceeding. STOP and wait.

---

## Phase 2: Multi-Source Web Research

// turbo

Run **at least 3** broad `search_web` queries targeting official sources:

1. **Primary Query**: The core topic (e.g., `"Next.js App Router best practices 2025"`)
2. **Comparison Query**: Alternatives or trade-offs (e.g., `"Next.js App Router vs Pages Router"`)
3. **Deep-Dive Query**: A specific technical angle (e.g., `"Next.js App Router caching strategies"`)

> [!TIP]
> Vary your queries. Don't just rephrase the same question. Each query should target a different **angle** of the topic.

---

## Phase 3: Community & Social Sentiment

// turbo

Run **at least 2** community-targeted `search_web` queries:

1. **Reddit Search**: `search_web` with `domain: "reddit.com"` — capture real user experiences, frustrations, and recommendations.
2. **Forum/Social Search**: At least one more from:
   - Stack Overflow (`domain: "stackoverflow.com"`)
   - Hacker News (`domain: "news.ycombinator.com"`)
   - X/Twitter (`domain: "x.com"`)
   - Dev.to (`domain: "dev.to"`)
   - GitHub Discussions

> [!IMPORTANT]
> Community sentiment is **critical**. Users often surface gotchas, workarounds, and real-world performance data that official docs never mention. Do NOT skip this phase.

---

## Phase 4: Deep Dive — Full Article Reads

// turbo

Use `read_url_content` on **at least 5** of the most promising URLs from Phases 2 and 3:

- At least **2 official/authoritative** sources (docs, blog posts, RFC/specs)
- At least **2 community** sources (Reddit threads, SO answers, forum posts)
- At least **1 wildcard** — the most interesting/contrarian take you found

For each source, extract:

- Key facts and data points
- Publish date / last updated date
- Author credibility (official team member? random blog? experienced dev?)

---

## Phase 5: Cross-Reference & Synthesis

1. **Fact Verification**: Cross-check key claims across multiple sources.
2. **Contradiction Map**: List any points where sources disagree. Present both positions.
3. **Official vs. Community Gap**: Highlight where official docs say one thing but the community experiences another.
4. **Consensus Extraction**: Identify the points that all/most sources agree on.
5. **Confidence Scoring**: Rate each finding as:
   - ✅ **High Confidence** — Multiple independent sources agree
   - ⚠️ **Medium Confidence** — Some support, but limited sources
   - ❓ **Low Confidence** — Single source or conflicting data

---

## Phase 6: Structured Report

Produce the final report with these **exact sections** (in order):

### Report Structure

```markdown
# Research Report: [Topic]

> Research Date: [current date]
> Sources Consulted: [count]

## Executive Summary

[2-3 paragraph overview of findings]

## Key Findings

[Numbered list of the most important discoveries, each with inline citation]

## Community Sentiment

[What real users are saying — pain points, praise, common complaints, workarounds]
[Include direct quotes from Reddit/forums where impactful]

## Source Comparison

| Source | Type               | Date | Key Position | Confidence |
| :----- | :----------------- | :--- | :----------- | :--------- |
| [URL]  | Official/Community | YYYY | ...          | ✅/⚠️/❓   |

## Contradictions & Open Questions

[Where sources disagree, or where information is missing]

## Recommendations

[Actionable takeaways based on the research]

## Full Citations

1. [Title](URL) — [Type] — [Date] — [Brief description]
2. ...
```

---

## Phase 7: Persist (Mandatory)

After generating the report:

1. Write the full report to `artifacts/superpowers/research.md` using `write_to_file`.
2. Confirm it exists by listing `artifacts/superpowers/`.
3. Notify the user with a summary of findings and the path to the report.

> [!CAUTION]
> Do NOT skip persistence. The entire point of this workflow is to produce a referenceable artifact.

---

## Guardrails

- **Minimum Searches**: 5 total (3 general + 2 community)
- **Minimum URL Reads**: 5 (mixed official + community)
- **Minimum Citations**: Every factual claim must have one
- **Date Range**: 2020–present preferred; flag older sources
- **No Implementation**: This workflow ends at the report. Period.
