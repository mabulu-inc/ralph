---
title: Customizing Prompts
description: How to extend ralph's built-in prompts, roles, and methodology for your project.
---

Ralph uses a **built-in-first** architecture: all prompts, roles, and methodology content live in ralph's package code and are used directly at runtime. They are never copied into your project. When you upgrade ralph, you automatically get the latest prompts.

To customize ralph's behavior, you create optional **extension files** in `docs/prompts/`. These files contain only your additions — they are appended to the built-in content, not replacements for it. If no extension files exist, ralph works with zero configuration.

## Extension Files

| File                          | Extends                    | Purpose                                                    |
| ----------------------------- | -------------------------- | ---------------------------------------------------------- |
| `docs/prompts/system.md`      | Built-in system prompt     | Additional system-level instructions                       |
| `docs/prompts/boot.md`        | Built-in boot prompt       | Additional boot-level content                              |
| `docs/prompts/methodology.md` | Built-in methodology       | Additional methodology guidance                            |
| `docs/prompts/roles.md`       | Built-in role definitions  | Role overrides, additions, and disables                    |
| `docs/prompts/rules.md`       | (standalone)               | Project-specific rules — the one file `ralph init` creates |

Extension content is appended after the corresponding built-in content, separated by a `--- Project Extensions ---` marker. Your extensions are never overwritten by any ralph command.

## Project Rules

Located at `docs/prompts/rules.md`, this file contains project-specific constraints that apply to every task:

```markdown
- All code goes under `src/myapp/`
- Tests go in `__tests__/` directories
- Use kebab-case for file names
- Do not use library X — we had issues with it in production
- All API endpoints must validate input with zod
```

Rules are injected as `{{project.rules}}` in the boot prompt. This is the only prompt-related file that `ralph init` creates — edit it to add conventions, restrictions, or guidance specific to your project.

## When to Use Each File

| Use This File                         | For This Purpose                                    |
| ------------------------------------- | --------------------------------------------------- |
| `rules.md`                            | Project-specific conventions and constraints         |
| `system.md`                           | Additional system-level methodology instructions     |
| `boot.md`                             | Additional task-level guidance or context             |
| `methodology.md`                      | Methodology adjustments or additions                 |
| `roles.md`                            | Role overrides, additions, or disables               |

Rules are for **"what"** constraints (file naming, library restrictions). Extension files are for **"how"** methodology (TDD adjustments, role customization, additional instructions).

## Examples

### Adding a System Prompt Extension

Create `docs/prompts/system.md`:

```markdown
When writing TypeScript, always use explicit return types on exported functions.

All monetary values must use integer cents, never floating-point dollars.
```

This content is appended after ralph's built-in system prompt. Run `ralph show system-prompt` to see the merged result.

### Customizing a Role

Create `docs/prompts/roles.md`:

```markdown
## Override: SDET

In this project, the SDET focuses on integration testing with real database connections.
All tests must hit the actual PostgreSQL instance, not mocks.
```

Run `ralph show roles` to verify the override is applied — the SDET role will show `[overridden]`.

### Adding a Custom Role

Add to `docs/prompts/roles.md`:

```markdown
## Add: Compliance Officer

- **Focus**: Regulatory compliance
- **Responsibility**: Reviews all data handling for GDPR/HIPAA compliance. Validates that PII is encrypted at rest and in transit. Checks audit logging for sensitive operations.
- **Participates**: Boot, Verify
```

The new role appears alongside the 9 built-in roles. Run `ralph show roles` to confirm.

### Disabling a Role

Add to `docs/prompts/roles.md`:

```markdown
## Disable: UX/UI Designer

This is a headless API project with no user-facing surface.
```

### Template Variables in Extensions

Extension files support the same `{{variable}}` syntax as built-in templates:

```markdown
This project uses {{config.language}} with {{config.packageManager}}.
The quality check command is `{{config.qualityCheck}}`.
```

See the [Prompts](/simplicity-ralph/core-concepts/prompts/) page for the full variable reference.

## Inspecting Effective Content

Use `ralph show` to inspect the merged result of built-in content plus your extensions:

```bash
ralph show system-prompt       # Effective system prompt
ralph show boot-prompt         # Effective boot prompt template
ralph show roles               # Active roles with source annotations
ralph show methodology         # Effective methodology
ralph show rules               # Project rules
ralph show task T-042          # What the agent receives for a specific task
```

Use `--built-in-only` to see just ralph's built-in content without your extensions, which is useful for understanding what you're extending.
