---
description: Analyzes staged/unstaged changes and generates a high-quality, exhaustive commit message.
---

# 🤖 AI Commit Message Generator (Exhaustive)

Use this workflow to generate a professional, highly detailed commit message that adheres to the project's conventions.

## Phase 1: Context Extraction 🔍

1. **Check for Staged Changes**:
   // turbo
   - Run `git diff --staged --stat` to check if there are staged changes.
   - **If NO staged changes found**: Run `git add -A` to stage all changes automatically.
   - Inform the user: "No staged changes detected. Automatically staged all changes."

2. **Extract Changes**:
   // turbo
   - Run `git diff --staged` to see what's about to be committed.
   - Run `git diff` to see current work-in-progress that isn't staged yet.
3. **Historical Context**:
   // turbo
   - Run `git log -5 --oneline` to understand the project's commit message style.

## Phase 2: AI Analysis 🧠

1. **Summarize Work (EXHAUSTIVE)**:
   - Analyze **ALL** hunks and **ALL** files in the captured diffs.
   - **MANDATORY**: Do not ignore any changes. Count the number of files in the diff and ensure every single one is mentioned at least once.
   - **Grouping**: Group changes by directory or logical component (e.g., `src/components`, `src/hooks`, `public/assets`).
   - Identify the primary intent (e.g., bug fix, feature, refactor, documentation).
   - Determine the scope (e.g., which component or utility was changed).

2. **Draft Message**:
   - Generate a message following the `type(scope): description` format.
   - **Comprehensive Body**:
     - Provide a mandatory bulleted list grouped by component.
     - For large diffs (10+ files), you MUST include a "Files Changed" section at the bottom of the body, listing every modified file and a 1-sentence summary of what changed in that specific file.
   - **Constraint**: Keep the first line under 50 characters.

3. **Self-Verification**:
   - Run `git diff --staged --name-only` (mentally or via tool if possible) and cross-reference your draft to ensure 100% coverage.

## Phase 3: Presentation & Artifacts 🚀

1. **Output Suggested Message**:
   - Display the generated message in a clear markdown block.
   - Provide the exact `git commit -m "..."` command for easy copying.

2. **Generate Temp File**:
   - **Action**: Use `write_to_file` to create a `COMMIT_MSG.md` file in the root directory.
   - **Content**: Include the full commit message (header + body) for easy copy-pasting into git GUIs or terminals.

## Phase 4: Cleanup & Convenience 🧹

1. **Copy to Clipboard** (Windows):
   // turbo
   - Run: `Get-Content COMMIT_MSG.md | Set-Clipboard`
   - **Note**: This ensures the message is captured before deletion.

2. **Auto-Cleanup**:
   - **Action**: Wait 1 second (to ensure clipboard capture works), then use `run_command` to delete `COMMIT_MSG.md`.
   - **Command**: `Remove-Item COMMIT_MSG.md` (Powershell) or `rm COMMIT_MSG.md`.
   - **Notify**: Inform the user that "COMMIT_MSG.md was generated, copied to clipboard, and auto-deleted."

---

## Allowed Temporary Files 📁

> [!NOTE]
> The agent is allowed to create **ONLY** the following temporary files to handle large diffs:
>
> - `staged_diff_full.txt`
> - `diff_output.txt`
> - `staged_files.txt`
>
> **CRITICAL**: You MUST delete these files immediately after generating `COMMIT_MSG.md`. Do not leave them in the workspace.

---

## Manual Cleanup Mode 🧹

If the user invokes this workflow with the keyword `clean` (e.g., `/msg clean`):

1. **Delete** the following files from the project root if they exist:
   // turbo
   - `COMMIT_MSG.md`
   - `staged_diff_full.txt`
   - `diff_output.txt`
   - `staged_files.txt`
2. **Confirm** to the user that cleanup is complete.
