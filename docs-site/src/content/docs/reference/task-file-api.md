---
title: Task File API
description: Full reference for ralph's task file format — a stable public API contract.
---

:::note[Stability: Public API]
The task file format is a **stable public contract**. New fields may be added, but existing fields will not change meaning or be removed without a major version bump. Unknown fields are ignored and preserved.
:::

Task files are Markdown files in `docs/tasks/` with the naming pattern `T-NNN.md`. They are ralph's unit of work — each file describes a single task for the AI agent to implement.

## Required Fields

These fields must be present for a task to be eligible:

| Field            | Format                              | Description                                           |
| ---------------- | ----------------------------------- | ----------------------------------------------------- |
| `Status`         | `TODO` \| `DONE` \| `BLOCKED`      | Task state. Ralph selects `TODO` tasks.               |
| `Milestone`      | `N — Name`                          | Grouping for progress tracking.                       |
| `Depends`        | Comma-separated `T-NNN` or `none`   | Dependency list. All must be `DONE` for eligibility.  |
| `PRD Reference`  | `§N.N` references                   | Sections injected into the agent prompt.              |

## Optional Fields

These fields are read when present, ignored when absent:

| Field              | Format                              | Description                                         |
| ------------------ | ----------------------------------- | --------------------------------------------------- |
| `Complexity`       | `light` \| `standard` \| `heavy`    | Overrides auto-detection for turn/timeout scaling.  |
| `Touches`          | Comma-separated file paths          | Files injected into the prompt for scoping.         |
| `Model`            | Model identifier string             | Overrides the project default model for this task.  |
| `Roles`            | Comma-separated role names          | Restricts which agent roles participate.            |
| `Completed`        | `YYYY-MM-DD HH:MM (Nm duration)`   | Set by the agent on completion.                     |
| `Commit`           | 40-character SHA                    | Backfilled by ralph post-iteration.                 |
| `Cost`             | `$N.NN`                             | Backfilled by ralph post-iteration.                 |
| `Blocked reason`   | Free text                           | Reason when Status is BLOCKED.                      |

## Sections

Ralph uses an **exclusion-based** model for task sections. Only the sections listed below are excluded from the task body sent to the agent. All other sections — including any custom sections you add — are included in `{{task.description}}` and reach the agent automatically.

### Excluded Sections

| Section               | Reason for Exclusion                                         |
| --------------------- | ------------------------------------------------------------ |
| `## Hints`            | Sent separately as `{{task.hints}}` to avoid duplication.    |
| `## Produces`         | Human reference only (expected deliverables).                |
| `## Completion Notes` | Written by the agent after completion, not actionable input. |
| `## Blocked`          | Used for eligibility check, not implementation guidance.     |

Everything else is included. You can freely add custom sections like `## Security Considerations`, `## Migration Plan`, `## Performance Requirements` — ralph includes them in the task body.

## Examples

### Minimal Task

```markdown
# T-001: Add health check endpoint

- **Status**: TODO
- **Milestone**: 1 — Infrastructure
- **Depends**: T-000
- **PRD Reference**: §2.1

## Description

Add a GET /health endpoint that returns 200 with `{"status": "ok"}`.

## AC

- GET /health returns 200
- Response body is `{"status": "ok"}`
```

### Fully-Populated Task

```markdown
# T-042: Add OAuth2 authentication flow

- **Status**: TODO
- **Milestone**: 3 — Authentication
- **Depends**: T-040, T-041
- **PRD Reference**: §4.2, §4.3
- **Complexity**: heavy
- **Touches**: `src/auth/oauth.ts`, `src/auth/__tests__/oauth.test.ts`
- **Model**: claude-opus-4-20250514
- **Roles**: Security Engineer, DBA

## Description

Implement the OAuth2 authorization code flow with PKCE for the web client.

## Changes

- New `OAuthProvider` class with Google and GitHub adapters
- Token refresh logic with secure storage
- CSRF protection via state parameter

## AC

- Authorization URL generation with PKCE challenge
- Token exchange with code verifier
- Refresh token rotation
- CSRF validation via state parameter

## Hints

The existing `AuthService` in `src/auth/service.ts` has a `registerProvider()` method
that should be used for plugging in OAuth providers.

## Produces

- `src/auth/oauth.ts`
- `src/auth/providers/google.ts`
- `src/auth/providers/github.ts`
- `src/auth/__tests__/oauth.test.ts`

## Security Considerations

All tokens must be stored encrypted. The PKCE verifier must be generated
with cryptographic randomness (crypto.randomBytes, not Math.random).
```

### Completed Task

```markdown
# T-001: Add health check endpoint

- **Status**: DONE
- **Milestone**: 1 — Infrastructure
- **Depends**: T-000
- **PRD Reference**: §2.1
- **Completed**: 2025-06-15 14:32 (8m duration)
- **Commit**: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
- **Cost**: $0.42

## Description

Add a GET /health endpoint that returns 200 with `{"status": "ok"}`.

## AC

- [x] GET /health returns 200
- [x] Response body is `{"status": "ok"}`

## Completion Notes

Implemented using Express route handler. Added integration test that
starts the server and hits the endpoint.
```

## Verification

Run `ralph show task T-NNN` to see exactly what the agent will receive for a task, including which sections are included and which are excluded:

```bash
ralph show task T-042           # Human-readable view
ralph show task T-042 --json    # Machine-readable view
```

## Scaffolding

Use `ralph task` to scaffold new task files:

```bash
ralph task "Add health check endpoint" --depends T-000 --prd-ref "§2.1"
```

See the [task command](/simplicity-ralph/commands/task/) for all options.
