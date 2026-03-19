---
title: review
description: Review task timeline, diagnose failures, and get project coaching.
---

```bash
pnpm dlx @smplcty/ralph review <task ID> [options]
# or
npx @smplcty/ralph review --coach
```

Review the execution history of a task or get project-wide coaching suggestions.

## Task Timeline

```bash
ralph review T-042
```

Displays a timeline of all attempts for a task, including:

- **Phase progression** — which phases were reached and their durations (Boot, Red, Green, Verify, Commit)
- **Role interplay** — which agent roles participated and their commentary, organized by phase
- **Cost and turns** — token cost and number of agent turns per attempt
- **Files changed** — files modified during the attempt
- **Status** — success (✓), failed (✗), or running (…)

### Multiple Attempts

When a task has been retried, review shows all attempts with clear labeling:

```
── Attempt 1 of 3 [✗ failed] ──
  Failure: timeout: Agent exceeded time limit
  Phases:
    Boot (45s)
    Red (1m 12s)
    Green (8m 30s)

── Attempt 2 of 3 [✗ failed] ──
  ...

── Attempt 3 of 3 [✓ success] ──
  ...
```

## Failure Diagnosis

```bash
ralph review T-042 --diagnose
```

Analyzes the most recent attempt to classify the failure and provide actionable recommendations:

- **Classification** — type of failure (timeout, blocked, test failure, build failure, etc.)
- **Detail** — specific failure context
- **Last phase** — where the iteration stopped
- **Last error** — the error message that caused the failure
- **Recommendations** — suggested actions to resolve the issue

## Task-Specific Coaching

```bash
ralph review T-042 --coach
```

When `--coach` is combined with a task ID, the coaching is specific to that task. Ralph gathers the task's execution data (log, role commentary, phase durations, retries, outcome) and sends it to the configured AI agent for intelligent analysis. This is not a heuristic check — it is an AI-powered review that understands context.

The AI receives:

- The task file content (description, AC, hints, etc.)
- The execution log summary (phases reached, role commentary, errors, outcome)
- Retry history if applicable
- The project's extension files and role customizations for context

The AI produces:

- **What went well** — specific strengths in the task definition and execution
- **What could improve** — specific, actionable suggestions
- **Role observations** — which roles provided valuable input and how their commentary influenced the outcome
- **Task definition quality** — whether the description, AC, and hints were sufficient, with specific improvement suggestions
- **Suggested changes** — concrete edits to the task file, extensions, or role customizations

## Project-Wide Coaching

```bash
ralph review --coach
```

When `--coach` is used without a task ID, ralph analyzes patterns across all tasks and sends the aggregated data to the AI for project-level coaching. The AI receives summaries of all completed and failed tasks, not just heuristic counts.

The AI produces:

- **Pattern analysis** — recurring issues across tasks (e.g., tasks consistently exceeding turn budgets)
- **Role effectiveness** — which roles are adding value vs. rubber-stamping, based on actual commentary content
- **Extension recommendations** — specific rules, role overrides, or system prompt extensions that would improve outcomes
- **Task authoring guidance** — project-specific advice on how to write better tasks for this codebase

## Options

| Flag                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `-d, --diagnose`       | Analyze failure and provide diagnosis    |
| `-c, --coach`          | Task-specific or project-wide AI coaching |
| `-v, --verbose`        | Show full role commentary (not truncated)|
| `-j, --json`           | Output as JSON                           |
