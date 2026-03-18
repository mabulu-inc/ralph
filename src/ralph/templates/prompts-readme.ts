export function generatePromptsReadme(): string {
  return `# Prompt Templates

This directory contains the prompt templates that ralph sends to the AI coding agent during each loop iteration. You can edit these files to customize methodology, tone, and agent behavior.

## Files

| File | Purpose |
|------|---------|
| \`system.md\` | Stable methodology rules (TDD, phases, tool usage, quality gates). Sent as the system prompt when the agent supports it. |
| \`boot.md\` | Per-task instructions with template variables. Sent as the user prompt. |
| \`rules.md\` | Project-specific rules injected into the boot prompt via \`{{project.rules}}\`. |

## Template Variables

The following variables are available in \`boot.md\`. Ralph replaces them before sending the prompt to the agent.

### Task Variables

| Variable | Description |
|----------|-------------|
| \`{{task.id}}\` | Task identifier (e.g., \`T-005\`) |
| \`{{task.title}}\` | Task title from the heading |
| \`{{task.description}}\` | Full task body: Description, Changes, AC, and Scope sections (excludes Hints, Produces, Completion Notes, Blocked) |
| \`{{task.prdReference}}\` | PRD section reference (e.g., \`§3.2\`) |
| \`{{task.prdContent}}\` | Extracted PRD section content matching the task's PRD Reference |
| \`{{task.touches}}\` | Comma-separated file paths from the Touches field, or "not specified" if empty |
| \`{{task.hints}}\` | Content of the task's Hints section (empty string if no Hints) |

### Config Variables

| Variable | Description |
|----------|-------------|
| \`{{config.language}}\` | Project language (e.g., \`TypeScript\`) |
| \`{{config.packageManager}}\` | Package manager (e.g., \`pnpm\`) |
| \`{{config.testingFramework}}\` | Testing framework (e.g., \`Vitest\`) |
| \`{{config.qualityCheck}}\` | Quality check command (e.g., \`pnpm check\`) |
| \`{{config.testCommand}}\` | Test command (e.g., \`pnpm test\`) |
| \`{{config.fileNaming}}\` | File naming convention (e.g., \`kebab-case\`), empty if unset |
| \`{{config.database}}\` | Database type (e.g., \`PostgreSQL\`), empty if unset |

### Injected Variables

| Variable | Description |
|----------|-------------|
| \`{{project.rules}}\` | Contents of \`rules.md\` (empty string if file is missing or empty) |
| \`{{codebaseIndex}}\` | Auto-generated file/export index for the project |
| \`{{retryContext}}\` | Context from a previous failed attempt (empty on first attempt) |

## Customization Tips

- **system.md** is read verbatim and not interpolated — template variables like \`{{task.id}}\` will NOT be replaced in this file.
- **boot.md** supports all template variables listed above.
- **rules.md** is injected as-is into the \`{{project.rules}}\` slot in boot.md.
- To regenerate these files with defaults, run \`ralph init --prompts-only\`.
`;
}
