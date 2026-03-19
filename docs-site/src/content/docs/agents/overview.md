---
title: Agent Overview
description: Multi-agent support and the provider abstraction pattern.
---

Ralph supports multiple AI coding agents through a provider abstraction. Each provider maps ralph's needs onto the agent's CLI interface, so the loop works identically regardless of which agent you choose.

## Supported Agents

| Agent          | Binary   | Print Mode        | JSON Output                   | Max Turns       |
| -------------- | -------- | ----------------- | ----------------------------- | --------------- |
| **Claude Code** | `claude` | `-p`              | `--output-format stream-json` | `--max-turns N` |
| **Gemini CLI** | `gemini` | `-p`              | `--output-format stream-json` | N/A             |
| **Codex CLI**  | `codex`  | `exec` subcommand | `--json`                      | N/A             |
| **Continue**   | `cn`     | `-p`              | `--output-format stream-json` | `--max-turns N` |
| **Cursor**     | `cursor` | `-p`              | `--output-format stream-json` | N/A             |

## Provider Interface

Every provider supplies:

| Capability                     | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| **binary**                     | CLI executable name                                      |
| **buildArgs(prompt, options)** | Construct the argument array for a headless invocation   |
| **outputFormat**               | How to request structured output                         |
| **supportsMaxTurns**           | Whether the agent accepts a max-turns limit              |
| **supportsSystemPrompt**       | Whether the agent accepts a system prompt via CLI        |
| **parseOutput(stream)**        | Normalize output into ralph's internal event format      |

## Choosing an Agent

Set the agent in `ralph.config.json`:

```json
{
  "agent": "claude"
}
```

Or override per-run:

```bash
pnpm dlx @smplcty/ralph loop --agent gemini
```

During `ralph init`, the agent is auto-detected based on which CLIs are installed (preference: claude → gemini → codex → continue → cursor).

## Max Turns

For agents that don't support `--max-turns`, ralph relies on its timeout mechanism to bound iteration length. The complexity scaling tiers still apply to timeout values.
