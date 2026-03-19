---
title: task
description: Scaffold a new task file with auto-numbered ID.
---

```bash
pnpm dlx @smplcty/ralph task "Task title" [options]
# or
npx @smplcty/ralph task "Task title" [options]
```

Scaffold a new task file in `docs/tasks/` with an auto-incremented task number. The generated file follows ralph's task file format with all required fields.

## Options

| Flag                     | Description                                   | Default    |
| ------------------------ | --------------------------------------------- | ---------- |
| `--depends <tasks>`      | Comma-separated dependency list               | `none`     |
| `--complexity <tier>`    | `light`, `standard`, or `heavy`               | (omitted)  |
| `--milestone <value>`    | Milestone number and name (e.g., `3 — Auth`)  | (omitted)  |
| `--prd-ref <sections>`   | PRD section references (e.g., `§3.2`)         | (omitted)  |
| `--touches <files>`      | Comma-separated file paths                    | (omitted)  |
| `--roles <roles>`        | Comma-separated role names                    | (omitted)  |
| `--dry-run`              | Print the generated content without writing   | off        |

## Examples

```bash
# Basic task
ralph task "Add user registration endpoint"

# Task with all options
ralph task "Add OAuth2 support" \
  --depends T-001,T-002 \
  --complexity heavy \
  --milestone "2 — Authentication" \
  --prd-ref "§3.2" \
  --touches "src/auth/oauth.ts,src/auth/__tests__/oauth.test.ts" \
  --roles "Security Engineer,DBA"

# Preview without writing
ralph task "Refactor config loader" --dry-run
```

## Custom Template

You can provide a custom task template by creating `docs/prompts/task-template.md`. The template must include `{{task.number}}` and `{{task.title}}` placeholders:

```markdown
# {{task.number}}: {{task.title}}

- **Status**: TODO
- **Milestone**:
- **Depends**: none
- **PRD Reference**:

## Description

## AC

## Security Considerations
```

When a custom template is present, `ralph task` uses it instead of the built-in scaffold. Ralph warns if the template is missing required placeholders.
