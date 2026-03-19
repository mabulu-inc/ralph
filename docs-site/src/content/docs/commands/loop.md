---
title: loop
description: The main AI development loop that picks tasks and drives your agent through TDD.
---

```bash
pnpm dlx @smplcty/ralph loop
# or
npx @smplcty/ralph loop
```

The main AI development loop. Runs the configured AI coding agent in stateless iterations, each picking up the next eligible task.

## How It Works

Each iteration is a structured collaboration between [9 specialized agent roles](/simplicity-ralph/core-concepts/roles/) — Product Manager, Architect, Security Engineer, and more. The roles participate at specific phases, with Boot and Verify acting as gate phases requiring explicit approval.

The iteration flow:

1. **Pre-flight** — verify agent CLI is installed, `docs/tasks/` exists, and quality check passes (aborts by default if it fails — use `--allow-dirty` to override)
2. **Clean slate** — discard unstaged changes from crashed iterations
3. **Find next task** — select lowest-numbered eligible TODO
4. **Build prompt** — assemble the built-in prompt layers with task and config variables
5. **Launch agent** — spawn the agent CLI with the rendered prompt
6. **Monitor** — track progress via the agent's output stream
7. **Timeout** — kill iterations exceeding the time limit
8. **Commit detection** — end iteration after a commit lands
9. **Post-iteration** — backfill SHAs, update costs, regenerate milestones, push

Ralph's built-in prompts, roles, and methodology are used directly from the package — they are not read from files in your project. User extensions in `docs/prompts/` are appended to the built-in content at prompt assembly time.

## Options

| Flag                        | Description                          | Default          |
| --------------------------- | ------------------------------------ | ---------------- |
| `-n, --iterations <N>`      | Max iterations                       | `10` (0 = ∞)    |
| `-d, --delay <seconds>`     | Delay between iterations             | `2`              |
| `-t, --timeout <seconds>`   | Max seconds per iteration            | auto             |
| `-m, --max-turns <N>`       | Max agent turns per iteration        | auto             |
| `-v, --verbose`             | Stream agent output to terminal      | off              |
| `--dry-run`                 | Print config and exit                | off              |
| `--no-push`                 | Don't auto-push after iterations     | off              |
| `--allow-dirty`             | Proceed despite pre-existing quality-check failures | off |
| `--agent <name>`            | Override configured agent            | from config      |

## Task Complexity Scaling

Ralph auto-scales timeout and max-turns based on task characteristics:

| Tier     | Criteria                                       | Max Turns | Timeout |
| -------- | ---------------------------------------------- | --------- | ------- |
| Light    | 0–1 deps, 1–2 produces, no integration keyword | 50        | 600s    |
| Standard | 2–3 deps OR 3–4 produces                       | 75        | 900s    |
| Heavy    | 4+ deps OR 5+ produces OR integration keyword  | 125       | 1200s   |

CLI flags `-m` and `-t` override auto-scaling when provided.

## Retry Context

When a task fails (timeout, non-zero exit, no commit detected), the next attempt includes context from the failed iteration:

- Last phase reached (Boot, Red, Green, Verify, Commit)
- Last error or failure output
- Files modified before failure

This prevents the agent from repeating the same mistake.

## Exit Conditions

The loop stops when:

- All tasks are `DONE`
- Max iterations reached
- Loop budget exceeded
- No eligible tasks (all remaining are blocked or have unmet dependencies)
- User interrupt (Ctrl+C)

The exit reason is captured and displayed by `ralph monitor`.
