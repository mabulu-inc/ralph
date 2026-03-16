import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  runPreflightCheck,
  formatPreflightBaseline,
  buildPreflightLogEntry,
  type PreflightCheckResult,
} from '../core/preflight.js';

describe('runPreflightCheck', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ralph-preflight-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns passed=true when the command succeeds', async () => {
    const result = await runPreflightCheck('echo ok', { cwd: tmpDir });
    expect(result.passed).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.output).toContain('ok');
  });

  it('returns passed=false with output when the command fails', async () => {
    // Use a shell command that exits non-zero and outputs an error
    const result = await runPreflightCheck(
      'node -e "process.stderr.write(\'err\\n\'); process.exit(1)"',
      {
        cwd: tmpDir,
      },
    );
    expect(result.passed).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(result.output).toContain('err');
  });

  it('returns timedOut=true when the command exceeds timeout', async () => {
    const result = await runPreflightCheck('sleep 60', {
      cwd: tmpDir,
      timeoutMs: 100,
    });
    expect(result.passed).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it('defaults timeout to 120 seconds', async () => {
    // Just verify it doesn't throw when no timeout is specified
    const result = await runPreflightCheck('echo fast', { cwd: tmpDir });
    expect(result.passed).toBe(true);
  });

  it('handles commands with arguments', async () => {
    const result = await runPreflightCheck('node -e "console.log(42)"', { cwd: tmpDir });
    expect(result.passed).toBe(true);
    expect(result.output).toContain('42');
  });
});

describe('formatPreflightBaseline', () => {
  it('returns empty string when preflight passed', () => {
    const result: PreflightCheckResult = { passed: true, output: 'all good', timedOut: false };
    expect(formatPreflightBaseline(result)).toBe('');
  });

  it('returns empty string when preflight timed out', () => {
    const result: PreflightCheckResult = { passed: false, output: '', timedOut: true };
    expect(formatPreflightBaseline(result)).toBe('');
  });

  it('returns formatted baseline when preflight failed', () => {
    const result: PreflightCheckResult = {
      passed: false,
      output: 'Error: lint failed\nError: type error in foo.ts',
      timedOut: false,
    };
    const baseline = formatPreflightBaseline(result);
    expect(baseline).toContain('Pre-existing failures');
    expect(baseline).toContain('Do not attempt to fix them');
    expect(baseline).toContain('lint failed');
    expect(baseline).toContain('type error in foo.ts');
  });
});

describe('buildPreflightLogEntry', () => {
  it('produces valid JSON with required fields', () => {
    const result: PreflightCheckResult = {
      passed: false,
      output: 'some errors',
      timedOut: false,
    };
    const entry = buildPreflightLogEntry(result);
    const parsed = JSON.parse(entry);
    expect(parsed.type).toBe('preflight');
    expect(parsed.passed).toBe(false);
    expect(parsed.timedOut).toBe(false);
    expect(parsed.output).toBe('some errors');
    expect(parsed.timestamp).toBeDefined();
  });

  it('includes timedOut flag when true', () => {
    const result: PreflightCheckResult = {
      passed: false,
      output: '',
      timedOut: true,
    };
    const parsed = JSON.parse(buildPreflightLogEntry(result));
    expect(parsed.timedOut).toBe(true);
  });
});
