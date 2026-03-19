---
title: migrate
description: Migrate legacy prompt files to the built-in-first extension model.
---

```bash
pnpm dlx @smplcty/ralph migrate [options]
# or
npx @smplcty/ralph migrate [options]
```

Migrate legacy ralph prompt files from the old copy-and-edit model to the built-in-first architecture. This command analyzes files that were copied into your project by earlier versions of ralph and determines the appropriate action for each.

## How It Works

Ralph scans for legacy files that are now built into the package:

- `docs/prompts/boot.md` — previously the full boot prompt template
- `docs/prompts/system.md` — previously the full system prompt
- `docs/prompts/README.md` — prompt directory documentation
- `docs/RALPH-METHODOLOGY.md` — methodology reference
- Agent instruction files (`.claude/CLAUDE.md`, `GEMINI.md`, etc.)

For each file found, ralph classifies it into one of three outcomes:

| Outcome      | Condition                                    | Action                                                  |
| ------------ | -------------------------------------------- | ------------------------------------------------------- |
| **REMOVE**   | File matches the built-in template exactly   | Delete the file — built-in content is identical         |
| **EXTRACT**  | File has user customizations added to template| Extract only the user additions as an extension file    |
| **SKIP**     | File content is unrecognized                 | Leave as-is — verify manually with `ralph show`         |

## Options

| Flag         | Description                                        |
| ------------ | -------------------------------------------------- |
| `--dry-run`  | Show migration plan without modifying any files    |
| `--force`    | Apply the migration (required for non-interactive) |

## Examples

```bash
# Preview what would change
ralph migrate --dry-run

# Apply the migration
ralph migrate --force
```

### Example Output

```
Migration plan:

  ✓ REMOVE  docs/prompts/boot.md (unmodified copy of built-in template)
  → EXTRACT docs/prompts/system.md (user customizations detected)
  ⚠ SKIP    docs/RALPH-METHODOLOGY.md (unrecognized — verify with ralph show)

Summary: 1 file removed, 1 file migrated to extensions, 1 file left as-is.
```

After migration, use `ralph show` to verify the effective content matches your expectations.
