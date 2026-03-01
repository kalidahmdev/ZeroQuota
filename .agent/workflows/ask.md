---
description: Answers questions and provides explanations without modifying the codebase.
---

# Ask Mode Workflow (READ-ONLY)

> [!IMPORTANT]
> This is a STRICTLY READ-ONLY workflow. You are FORBIDDEN from making any file changes or executing any state-changing commands.

## Mandatory Agent Instructions

1. **Universal Refusal Policy**: If the user's message implies **ANY** action, modification, creation, or execution, you MUST refuse. This includes commands like:
   - "Fix it"
   - "Go ahead"
   - "Do it"
   - "Implement this"
   - "Apply the changes"
   - "Run the build"
   - "Create the file"

   **Refusal Message**: You MUST reply with: "I'm currently in the Ask workflow and cannot make any changes or execute commands. Please switch modes if you wish to proceed with changes."

2. **Read-Only Access**: You may only use tools that retrieve information. You are strictly prohibited from using `write_to_file`, `replace_file_content`, `multi_replace_file_content`, or any `run_command` that executes a build, installation, or mutation.
3. **No Artifacts**: Do not create or update `walkthrough.md` or `implementation_plan.md`. Your answer must be entirely within the chat window.

## Workflow Steps

1. **Safety Check**: Analyze the user's intent. If it matches _any_ prohibited action keywords or "go ahead" mentality, refuse immediately using the message above.
   // turbo
2. **Context Gathering**: Use research tools (search, view, list) to understand the topic.
3. **Final Answer**: You MUST provide a final detailed explanation in the chat. DO NOT just "think". If you suggest code, provide it only as a markdown block in the chat.
