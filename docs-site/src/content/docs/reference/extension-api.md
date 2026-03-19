---
title: Extension API
description: Full reference for ralph's extension mechanism — a stable public API contract.
---

:::note[Stability: Public API]
The extension mechanism is a **stable public contract**. New extension file types may be added in future versions. Existing extension files will continue to work unchanged. Extension behaviors will not change without a major version bump.
:::

Ralph's prompts follow a built-in-first architecture. All methodology content, prompt templates, and role definitions live in ralph's package code. Users extend this content through optional files in `docs/prompts/`.

## Three Guarantees

1. **Always optional** — Extension files are never required. Ralph works with zero extension files.
2. **Never overwritten** — No ralph command (init, loop, or otherwise) modifies files in `docs/prompts/` (except creating `rules.md` during `ralph init`).
3. **Appended, not replaced** — Extension content is appended after built-in content, separated by a `--- Project Extensions ---` marker. User content never replaces built-in content (except role overrides via the explicit `## Override:` directive).

## Extension File Reference

| File                            | Merge Behavior                     | Format                                                                                                     |
| ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `docs/prompts/system.md`        | Appended to built-in system prompt | Free-form Markdown. Template variables supported.                                                          |
| `docs/prompts/boot.md`          | Appended to built-in boot prompt   | Free-form Markdown. Template variables supported.                                                          |
| `docs/prompts/methodology.md`   | Appended to built-in methodology   | Free-form Markdown.                                                                                        |
| `docs/prompts/rules.md`         | Injected as `{{project.rules}}`    | Free-form Markdown.                                                                                        |
| `docs/prompts/roles.md`         | Merged with built-in roles         | Directive headings: `## Override:`, `## Add:`, `## Disable:`                                               |
| `docs/prompts/task-template.md` | Replaces built-in task scaffold    | Markdown task template for `ralph task`. Must include `{{task.number}}` and `{{task.title}}` placeholders. |

## Template Variable Reference

Template variables use `{{variable}}` syntax and are interpolated in both built-in templates and user extension files:

| Variable                      | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| `{{task.id}}`                 | Task ID (e.g., `T-005`)                                           |
| `{{task.title}}`              | Task title                                                        |
| `{{task.description}}`        | Task description body                                             |
| `{{task.prdReference}}`       | PRD section reference (e.g., `§3.2`)                              |
| `{{task.prdContent}}`         | Extracted PRD section content                                     |
| `{{task.touches}}`            | Comma-separated file paths from Touches field (blank if unset)    |
| `{{task.hints}}`              | Content of the task's Hints section (blank if no Hints)           |
| `{{config.language}}`         | Project language (e.g., `TypeScript`)                             |
| `{{config.packageManager}}`   | Package manager (e.g., `pnpm`)                                   |
| `{{config.testingFramework}}` | Testing framework (e.g., `Vitest`)                                |
| `{{config.qualityCheck}}`     | Quality check command (e.g., `pnpm check`)                       |
| `{{config.testCommand}}`      | Test command (e.g., `pnpm test`)                                  |
| `{{config.fileNaming}}`       | File naming convention (e.g., `kebab-case`, blank if unset)      |
| `{{project.rules}}`           | Contents of `docs/prompts/rules.md`                               |
| `{{codebaseIndex}}`           | Auto-generated file/export index                                  |
| `{{retryContext}}`            | Context from a previous failed attempt (empty on first attempt)   |

## roles.md Directive Format

The `docs/prompts/roles.md` file uses Markdown headings with specific directives to customize the 9 built-in roles.

### Override Directive

Replace a built-in role's description:

```markdown
## Override: SDET

In this project, the SDET focuses on integration testing with real database connections.
All tests must hit the actual PostgreSQL instance, not mocks.
```

The role keeps its name, focus, and participation phases but gets the new description.

### Add Directive

Define a new role:

```markdown
## Add: Compliance Officer

- **Focus**: Regulatory compliance
- **Responsibility**: Reviews all data handling for GDPR/HIPAA compliance. Validates that PII is encrypted at rest and in transit.
- **Participates**: Boot, Verify
```

Required fields for added roles: **Focus**, **Responsibility**, **Participates** (comma-separated phase names).

### Disable Directive

Remove a built-in role from the project:

```markdown
## Disable: UX/UI Designer

This is a headless API project with no user-facing surface.
```

The description text after the heading is informational — it documents why the role is disabled.

## Per-Task Role Selection

Task files may include an optional `Roles` field to restrict which roles participate:

```markdown
- **Roles**: DBA, Compliance Officer
```

When `Roles` is present, only the listed roles participate (plus Frontend & Backend Engineers, which always participate). When absent, all applicable roles participate.

## Verification

Use `ralph show` to inspect the effective merged content:

```bash
ralph show system-prompt       # Built-in system prompt + docs/prompts/system.md
ralph show boot-prompt         # Built-in boot prompt + docs/prompts/boot.md
ralph show roles               # Built-in roles + docs/prompts/roles.md customizations
ralph show methodology         # Built-in methodology + docs/prompts/methodology.md
ralph show rules               # Contents of docs/prompts/rules.md

# See only built-in content (without extensions)
ralph show system-prompt --built-in-only

# Machine-readable output
ralph show roles --json
```
