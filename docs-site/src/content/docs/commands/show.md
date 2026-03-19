---
title: show
description: Inspect effective prompts, roles, and methodology content.
---

```bash
pnpm dlx @smplcty/ralph show <subcommand> [options]
# or
npx @smplcty/ralph show <subcommand> [options]
```

Display the effective prompt content that ralph sends to the agent. Shows both built-in content and any user extensions merged together.

## Subcommands

### system-prompt

```bash
ralph show system-prompt
```

Display the effective system prompt — ralph's built-in TDD methodology, tool rules, quality gates, and role definitions, plus any content from `docs/prompts/system.md`.

### boot-prompt

```bash
ralph show boot-prompt
```

Display the effective boot prompt template — ralph's built-in task/config/scoping sections, plus any content from `docs/prompts/boot.md`. Template variables (e.g., `{{task.id}}`) are shown as placeholders.

### roles

```bash
ralph show roles
```

Display all active roles with source annotations. Each role shows:

- **Name** and focus area
- **Responsibility** description
- **Participation** phases (Boot, Red, Green, Verify)
- **Source** — `[built-in]`, `[overridden]`, `[added]`, or `[disabled]`

### methodology

```bash
ralph show methodology
```

Display the Ralph Methodology reference — the full built-in methodology content, plus any additions from `docs/prompts/methodology.md`.

### rules

```bash
ralph show rules
```

Display the project-specific rules from `docs/prompts/rules.md`. Rules are injected into the prompt via `{{project.rules}}`.

### task

```bash
ralph show task T-NNN
```

Display what the agent will receive for a specific task:

- **Task body** — the content injected as `{{task.description}}`
- **Hints** — content injected as `{{task.hints}}`
- **Excluded sections** — sections not sent to the agent (Hints, Produces, Completion Notes, Blocked)
- **Active roles** — which roles participate for this task, with source annotations

## Options

| Flag              | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `--json`          | Output as JSON with structured fields                |
| `--built-in-only` | Show only built-in content, ignoring user extensions |

## Examples

```bash
# See what the agent gets as its system prompt
ralph show system-prompt

# Check roles including your customizations
ralph show roles

# Verify a task's effective content before running the loop
ralph show task T-042

# Get machine-readable output
ralph show roles --json

# See only ralph's built-in system prompt, without extensions
ralph show system-prompt --built-in-only
```
