---
title: Continue
description: Setup and configuration for Continue with ralph.
---

## Prerequisites

Install Continue following the [official Continue documentation](https://docs.continue.dev/getting-started/install).

## Configuration

```json
{
  "agent": "continue"
}
```

## How Ralph Uses It

Ralph spawns Continue with:

```bash
cn -p "<boot prompt>" --output-format stream-json --max-turns N
```

- `-p` — print mode (non-interactive, single prompt)
- `--output-format stream-json` — structured JSONL output
- `--max-turns` — supported, limits agent turns

## Agent Instructions

Ralph's loop prompt is self-contained — it does not depend on or manage `~/.continue/config.yaml` or any other agent-specific instructions file. All methodology content, roles, and behavioral rules are injected directly into the agent session.
