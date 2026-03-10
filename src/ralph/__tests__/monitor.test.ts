import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parsePhases,
  formatPhaseTimeline,
  formatProgressBar,
  detectStatus,
  findLatestLogFile,
  extractTaskIdFromLog,
  formatMonitorOutput,
  run,
  type RunResult,
} from '../commands/monitor.js';

describe('parsePhases', () => {
  it('extracts phase names from log content', () => {
    const content = [
      '{"type":"text","text":"[PHASE] Entering: Boot"}',
      '{"type":"text","text":"some other output"}',
      '{"type":"text","text":"[PHASE] Entering: Red"}',
      '{"type":"text","text":"[PHASE] Entering: Green"}',
    ].join('\n');
    expect(parsePhases(content)).toEqual(['Boot', 'Red', 'Green']);
  });

  it('returns empty array when no phases found', () => {
    expect(parsePhases('no phases here')).toEqual([]);
  });

  it('handles empty content', () => {
    expect(parsePhases('')).toEqual([]);
  });

  it('extracts phases from plain text lines too', () => {
    const content = '[PHASE] Entering: Verify\n[PHASE] Entering: Commit\n';
    expect(parsePhases(content)).toEqual(['Verify', 'Commit']);
  });
});

describe('formatPhaseTimeline', () => {
  it('renders all phases with markers for completed ones', () => {
    const result = formatPhaseTimeline(['Boot', 'Red', 'Green']);
    expect(result).toContain('Boot');
    expect(result).toContain('Red');
    expect(result).toContain('Green');
    expect(result).toContain('Verify');
    expect(result).toContain('Commit');
  });

  it('marks completed phases differently from pending ones', () => {
    const result = formatPhaseTimeline(['Boot', 'Red']);
    // Completed phases should have a filled marker
    expect(result).toMatch(/[●✓].*Boot/);
    expect(result).toMatch(/[●✓].*Red/);
    // Pending phases should have an empty marker
    expect(result).toMatch(/[○·].*Green/);
  });

  it('renders empty timeline when no phases', () => {
    const result = formatPhaseTimeline([]);
    // All phases should be pending
    expect(result).toContain('Boot');
    expect(result).toContain('Commit');
  });
});

describe('formatProgressBar', () => {
  it('shows 0% for no tasks done', () => {
    const result = formatProgressBar(0, 10);
    expect(result).toContain('0/10');
    expect(result).toContain('0%');
  });

  it('shows 100% when all tasks done', () => {
    const result = formatProgressBar(5, 5);
    expect(result).toContain('5/5');
    expect(result).toContain('100%');
  });

  it('shows partial progress', () => {
    const result = formatProgressBar(3, 10);
    expect(result).toContain('3/10');
    expect(result).toContain('30%');
  });

  it('handles zero total tasks', () => {
    const result = formatProgressBar(0, 0);
    expect(result).toContain('0/0');
  });
});

describe('detectStatus', () => {
  it('returns RUNNING when ralph processes exist', () => {
    expect(detectStatus([1234])).toBe('RUNNING');
  });

  it('returns STOPPED when no ralph processes exist', () => {
    expect(detectStatus([])).toBe('STOPPED');
  });
});

describe('findLatestLogFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ralph-monitor-log-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the most recent log file', async () => {
    await writeFile(join(dir, 'T-001-20260310-100000.jsonl'), '');
    await writeFile(join(dir, 'T-002-20260310-120000.jsonl'), '');
    const result = await findLatestLogFile(dir);
    expect(result).toBe('T-002-20260310-120000.jsonl');
  });

  it('returns null when no log files exist', async () => {
    const result = await findLatestLogFile(dir);
    expect(result).toBeNull();
  });

  it('returns null when directory does not exist', async () => {
    const result = await findLatestLogFile(join(dir, 'nonexistent'));
    expect(result).toBeNull();
  });
});

describe('extractTaskIdFromLog', () => {
  it('extracts task ID from log filename', () => {
    expect(extractTaskIdFromLog('T-001-20260310-120000.jsonl')).toBe('T-001');
  });

  it('extracts multi-digit task ID', () => {
    expect(extractTaskIdFromLog('T-015-20260310-120000.jsonl')).toBe('T-015');
  });

  it('returns null for non-matching filename', () => {
    expect(extractTaskIdFromLog('random-file.txt')).toBeNull();
  });
});

describe('formatMonitorOutput', () => {
  it('formats complete monitor display', () => {
    const output = formatMonitorOutput({
      status: 'RUNNING',
      done: 5,
      total: 10,
      currentTaskId: 'T-006',
      currentTaskTitle: 'Monitor command',
      phases: ['Boot', 'Red'],
    });
    expect(output).toContain('RUNNING');
    expect(output).toContain('5/10');
    expect(output).toContain('T-006');
    expect(output).toContain('Monitor command');
    expect(output).toContain('Boot');
  });

  it('formats display with no current task', () => {
    const output = formatMonitorOutput({
      status: 'STOPPED',
      done: 10,
      total: 10,
      currentTaskId: null,
      currentTaskTitle: null,
      phases: [],
    });
    expect(output).toContain('STOPPED');
    expect(output).toContain('10/10');
    expect(output).not.toContain('Phase');
  });
});

describe('ralph monitor (run)', () => {
  let dir: string;
  let logsDir: string;
  let tasksDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ralph-monitor-test-'));
    logsDir = join(dir, '.ralph-logs');
    tasksDir = join(dir, 'docs', 'tasks');
    await mkdir(logsDir, { recursive: true });
    await mkdir(tasksDir, { recursive: true });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await rm(dir, { recursive: true, force: true });
  });

  it('shows status and progress for a project', async () => {
    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: First task\n\n- **Status**: DONE\n- **Milestone**: 1 — Setup\n- **Depends**: none\n- **PRD Reference**: §1\n\n## Description\n\nDone task.\n`,
    );
    await writeFile(
      join(tasksDir, 'T-002.md'),
      `# T-002: Second task\n\n- **Status**: TODO\n- **Milestone**: 1 — Setup\n- **Depends**: T-001\n- **PRD Reference**: §2\n\n## Description\n\nPending task.\n`,
    );

    await run([], dir);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('1/2');
    expect(output).toContain('50%');
  });

  it('shows current task and phases from latest log', async () => {
    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: First task\n\n- **Status**: DONE\n- **Milestone**: 1 — Setup\n- **Depends**: none\n- **PRD Reference**: §1\n\n## Description\n\nDone.\n`,
    );
    await writeFile(
      join(tasksDir, 'T-002.md'),
      `# T-002: Second task\n\n- **Status**: TODO\n- **Milestone**: 1 — Setup\n- **Depends**: T-001\n- **PRD Reference**: §2\n\n## Description\n\nPending.\n`,
    );

    const logContent = [
      '{"type":"text","text":"[PHASE] Entering: Boot"}',
      '{"type":"text","text":"[PHASE] Entering: Red"}',
    ].join('\n');
    await writeFile(join(logsDir, 'T-002-20260310-120000.jsonl'), logContent);

    await run([], dir);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('T-002');
    expect(output).toContain('Second task');
    expect(output).toContain('Boot');
  });

  it('handles missing tasks directory', async () => {
    await rm(tasksDir, { recursive: true, force: true });

    await run([], dir);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No tasks');
  });

  it('handles empty tasks directory', async () => {
    // tasksDir exists but has no task files
    await run([], dir);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No tasks found');
  });

  it('shows help for --help flag', async () => {
    await run(['--help'], dir);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Usage');
  });

  it('returns watching:true with stop fn in watch mode', async () => {
    vi.useFakeTimers();

    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: Task\n\n- **Status**: DONE\n- **Milestone**: 1 — Setup\n- **Depends**: none\n- **PRD Reference**: §1\n\n## Description\n\nDone.\n`,
    );

    const result: RunResult = await run(['-w', '-i', '1'], dir);
    expect(result.watching).toBe(true);
    expect(result.stop).toBeTypeOf('function');

    // Advance timer to trigger one refresh
    await vi.advanceTimersByTimeAsync(1100);

    result.stop!();
    vi.useRealTimers();
  });

  it('defaults to 5 second interval when -i has no value', async () => {
    vi.useFakeTimers();

    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: Task\n\n- **Status**: TODO\n- **Milestone**: 1 — Setup\n- **Depends**: none\n- **PRD Reference**: §1\n\n## Description\n\nPending.\n`,
    );

    const result: RunResult = await run(['--watch'], dir);
    expect(result.watching).toBe(true);
    result.stop!();
    vi.useRealTimers();
  });
});
