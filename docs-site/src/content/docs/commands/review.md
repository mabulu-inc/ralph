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

## Project Coaching

```bash
ralph review --coach
```

Analyzes the entire project for improvement opportunities:

- **Task quality** — identifies tasks with missing acceptance criteria, vague descriptions, or missing PRD references
- **Role effectiveness** — evaluates how well agent roles are being utilized
- **Extension health** — checks extension files for issues

## Options

| Flag                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `-d, --diagnose`       | Analyze failure and provide diagnosis    |
| `-c, --coach`          | Project-wide coaching suggestions        |
| `-v, --verbose`        | Show full role commentary (not truncated)|
| `-j, --json`           | Output as JSON                           |
