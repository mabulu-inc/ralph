import { exec } from 'node:child_process';

export interface PreflightCheckResult {
  passed: boolean;
  output: string;
  timedOut: boolean;
}

export function runPreflightCheck(
  qualityCheckCmd: string,
  options?: { timeoutMs?: number; cwd?: string },
): Promise<PreflightCheckResult> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const cwd = options?.cwd ?? process.cwd();

  return new Promise((resolve) => {
    const child = exec(qualityCheckCmd, { cwd, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (!err) {
        resolve({ passed: true, output: stdout + stderr, timedOut: false });
        return;
      }
      if (child.killed) {
        resolve({ passed: false, output: '', timedOut: true });
        return;
      }
      resolve({ passed: false, output: stdout + stderr, timedOut: false });
    });
  });
}

export function formatPreflightBaseline(result: PreflightCheckResult): string {
  if (result.passed || result.timedOut) return '';
  return [
    '# Pre-existing failures',
    '',
    'The following failures exist before your task. Do not attempt to fix them. Only ensure you do not add new failures.',
    '',
    '```',
    result.output.trim(),
    '```',
  ].join('\n');
}

export function buildPreflightLogEntry(result: PreflightCheckResult): string {
  return JSON.stringify({
    type: 'preflight',
    timestamp: new Date().toISOString(),
    passed: result.passed,
    timedOut: result.timedOut,
    output: result.output,
  });
}
