---
title: Prompts
description: Built-in-first prompt architecture with layered content and user extensions.
---

Ralph uses a **built-in-first** layered prompt architecture. All prompt content lives in ralph's package code and is assembled at runtime. Users extend the built-in content through optional files in `docs/prompts/` — these are appended to (not replacements for) the built-in content.

## Layered Architecture

The prompt is split into layers to maximize API cache hits and reduce token waste. Each layer has a built-in component from ralph's code and an optional user extension:

| Layer           | Built-in Content                                        | User Extension File           | Stability                                 |
| --------------- | ------------------------------------------------------- | ----------------------------- | ----------------------------------------- |
| **System**      | TDD methodology, tool usage rules, roles, quality gates | `docs/prompts/system.md`      | Stable across all iterations (cacheable)  |
| **Methodology** | Ralph Methodology reference                             | `docs/prompts/methodology.md` | Stable across all iterations (cacheable)  |
| **Roles**       | 9 built-in role definitions and participation rules     | `docs/prompts/roles.md`       | Stable across all iterations (cacheable)  |
| **Project**     | Config values, file naming, quality commands            | —                             | Stable across iterations (cacheable)      |
| **Rules**       | —                                                       | `docs/prompts/rules.md`       | Stable across iterations (cacheable)      |
| **Codebase**    | Auto-generated file/export index                        | —                             | Changes only when files are added/removed |
| **Task**        | Task description, PRD section content, touches, hints   | —                             | Changes per task                          |
| **Retry**       | Previous failure context                                | —                             | Only present on retries                   |

For agents that support `--system-prompt` (or equivalent), the System, Methodology, Roles, Project, and Rules layers are passed as the system prompt. The remaining layers are passed as the user prompt. This maximizes prompt caching at the API level.

## Runtime Assembly

For each prompt layer, ralph assembles the effective content as:

```
effective_content = built_in_content() + user_extension_content()
```

If a user extension file does not exist, the built-in content is used alone. Extension content is appended after the built-in content, separated by a `--- Project Extensions ---` marker.

This means ralph works with zero user-authored prompt files — `docs/prompts/rules.md` (created by `ralph init`) is the only prompt file that exists by default.

## Template Variables

Ralph replaces `{{variable}}` placeholders before sending the prompt. Template variables work in both built-in templates and user extension files:

| Variable                      | Value                                              |
| ----------------------------- | -------------------------------------------------- |
| `{{task.id}}`                 | Task ID (e.g., `T-005`)                            |
| `{{task.title}}`              | Task title                                         |
| `{{task.description}}`        | Task description                                   |
| `{{task.prdReference}}`       | PRD section reference (e.g., `§3.2`)               |
| `{{task.prdContent}}`         | Extracted PRD section content                      |
| `{{task.touches}}`            | Comma-separated file paths from Touches field      |
| `{{task.hints}}`              | Content of the task's Hints section                |
| `{{config.language}}`         | Project language                                   |
| `{{config.packageManager}}`   | Package manager                                    |
| `{{config.testingFramework}}` | Testing framework                                  |
| `{{config.qualityCheck}}`     | Quality check command                              |
| `{{config.testCommand}}`      | Test command                                       |
| `{{config.fileNaming}}`       | File naming convention                             |
| `{{project.rules}}`           | Contents of `docs/prompts/rules.md`                |
| `{{codebaseIndex}}`           | Auto-generated file/export index                   |
| `{{retryContext}}`            | Context from a previous failed attempt             |

## Inspecting Prompts

Use `ralph show` to inspect effective prompt content:

```bash
ralph show system-prompt       # Built-in + extensions
ralph show boot-prompt         # Built-in + extensions
ralph show methodology         # Built-in + extensions
ralph show rules               # Project rules
ralph show task T-042          # Effective task content

# See only built-in content
ralph show system-prompt --built-in-only
```

## Customization

See the [Customizing Prompts](/simplicity-ralph/guides/customizing-prompts/) guide for details on creating extension files, adding custom roles, and overriding built-in content.
