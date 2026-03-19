---
title: Gemini CLI
description: Setup and configuration for Gemini CLI with ralph.
---

## Prerequisites

Install the Gemini CLI:

```bash
npm install -g @google/gemini-cli
```

## Configuration

```json
{
  "agent": "gemini",
  "model": "gemini-2.5-pro"
}
```

## How Ralph Uses It

Ralph spawns Gemini CLI with:

```bash
gemini -p "<boot prompt>" --output-format stream-json
```

- `-p` — print mode (non-interactive, single prompt)
- `--output-format stream-json` — structured JSONL output
- No `--max-turns` support — ralph uses its timeout mechanism

## Agent Instructions

Ralph's loop prompt is self-contained — it does not generate or manage `GEMINI.md` or any other agent-specific instructions file. All methodology content, roles, and behavioral rules are injected directly into the agent session.
