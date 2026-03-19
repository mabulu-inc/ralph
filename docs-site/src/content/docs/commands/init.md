---
title: init
description: Interactive project bootstrapper that scaffolds ralph files.
---

```bash
pnpm dlx @smplcty/ralph init
# or
npx @smplcty/ralph init
```

Interactive project bootstrapper. Prompts for project configuration, then creates the Ralph Methodology scaffolding.

## Prompts

Ralph asks for:

1. **Project name** — used in generated files
2. **Language** — TypeScript, Python, Go, Rust, etc.
3. **Package manager** — pnpm, npm, yarn, pip, cargo, etc.
4. **Test framework** — Vitest, Jest, pytest, etc.
5. **Check command** — the quality gate command (e.g., `pnpm check`)
6. **AI agent** — claude, gemini, codex, continue, cursor (auto-detected from installed CLIs)
7. **Model** — specific model override (optional, uses agent default)

## Generated Files

| File                      | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| `docs/PRD.md`             | Skeleton PRD with numbered sections        |
| `docs/tasks/T-000.md`     | Infrastructure bootstrap task              |
| `docs/prompts/rules.md`   | Project-specific rules (editable)          |
| `ralph.config.json`       | Project configuration                      |

Ralph's methodology, prompts, and role definitions live in the package code and are used directly at runtime — they are not copied into your project. This means you always get the latest version when you upgrade ralph. See [Customizing Prompts](/simplicity-ralph/guides/customizing-prompts/) for how to extend the built-in content.

## Behavior

- If files already exist, ralph warns and asks before overwriting
- For Node.js projects, adds ralph scripts to `package.json`
- If no check command exists, scaffolds one
- Auto-detects installed agent CLIs (preference: claude → gemini → codex → continue → cursor)
- Warns if the selected agent CLI is not installed
