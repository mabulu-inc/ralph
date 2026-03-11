const TASK_ID_RE = /^T-\d+$/;
const GIT_REF_RE = /^[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/;

export function assertSafeTaskId(value: string): void {
  if (!TASK_ID_RE.test(value)) {
    throw new Error(`Invalid task ID: ${JSON.stringify(value)}`);
  }
}

export function assertSafeGitRef(value: string): void {
  if (!value || !GIT_REF_RE.test(value) || value.includes('..') || value.includes('\x00')) {
    throw new Error(`Invalid git ref: ${JSON.stringify(value)}`);
  }
}

export function assertSafeFilePath(value: string): void {
  if (!value || value.includes('\x00') || value.includes('\n') || value.startsWith('-')) {
    throw new Error(`Invalid file path: ${JSON.stringify(value)}`);
  }
}

export function assertSafeShellArg(value: string): void {
  if (!value || value.includes('\x00') || value.startsWith('-')) {
    throw new Error(`Invalid argument: ${JSON.stringify(value)}`);
  }
}
