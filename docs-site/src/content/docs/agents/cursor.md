---
title: Cursor
description: Setup and configuration for Cursor with ralph.
---

## Prerequisites

Install Cursor and ensure the `cursor` CLI is available on your PATH.

## Configuration

```json
{
  "agent": "cursor"
}
```

## How Ralph Uses It

Ralph spawns Cursor with:

```bash
cursor -p "<boot prompt>" --output-format stream-json
```

- `-p` — print mode (non-interactive, single prompt)
- `--output-format stream-json` — structured JSONL output
- No `--max-turns` support — ralph uses its timeout mechanism

## Agent Instructions

Ralph's loop prompt is self-contained — it does not generate or manage `.cursor/rules/` or any other agent-specific instructions file. All methodology content, roles, and behavioral rules are injected directly into the agent session.
