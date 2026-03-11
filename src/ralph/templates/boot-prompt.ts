export function defaultBootPromptTemplate(): string {
  return `CURRENT TASK (already selected — do NOT scan task files or check statuses):
{{task.id}}: {{task.title}}
PRD Reference: {{task.prdReference}}
Description: {{task.description}}

PROJECT CONFIG:
- Language: {{config.language}}
- Package manager: {{config.packageManager}}
- Testing framework: {{config.testingFramework}}
- quality check: {{config.qualityCheck}}
- Test command: {{config.testCommand}}
- File naming: {{config.fileNaming}}
- Database: {{config.database}}

{{project.rules}}

FILE SCOPING:
Files this task touches: {{task.touches}}
Read these files first during Boot. Skip unrelated files. During TDD, run only the relevant test file(s) — not the full quality check command. Save the full quality check run for the Verify phase before committing.

CODEBASE INDEX:
{{codebaseIndex}}

{{retryContext}}`;
}
