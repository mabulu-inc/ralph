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
  renderDashboard,
  run,
  parseCurrentPhase,
  parseLastLogLine,
  readLogTail,
  formatElapsed,
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

describe('parseCurrentPhase', () => {
  it('extracts the last phase name and timestamp from JSONL content', () => {
    const content = [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"[PHASE] Entering: Boot"}]},"timestamp":"2026-03-10T12:00:00Z"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"some work"}]},"timestamp":"2026-03-10T12:01:00Z"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"[PHASE] Entering: Red"}]},"timestamp":"2026-03-10T12:02:00Z"}',
    ].join('\n');
    const result = parseCurrentPhase(content);
    expect(result).not.toBeNull();
    expect(result!.phase).toBe('Red');
    expect(result!.startedAt).toEqual(new Date('2026-03-10T12:02:00Z'));
  });

  it('returns null when no phases found', () => {
    const content = '{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]}}\n';
    expect(parseCurrentPhase(content)).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(parseCurrentPhase('')).toBeNull();
  });

  it('falls back to null timestamp when no timestamp in JSONL entry', () => {
    const content = '{"type":"text","text":"[PHASE] Entering: Green"}\n';
    const result = parseCurrentPhase(content);
    expect(result).not.toBeNull();
    expect(result!.phase).toBe('Green');
    expect(result!.startedAt).toBeNull();
  });

  it('handles malformed JSON lines gracefully', () => {
    const content = [
      'not valid json',
      '{"type":"text","text":"[PHASE] Entering: Boot"}',
      'also not json',
    ].join('\n');
    const result = parseCurrentPhase(content);
    expect(result).not.toBeNull();
    expect(result!.phase).toBe('Boot');
  });
});

describe('parseLastLogLine', () => {
  it('extracts the last assistant text from JSONL content', () => {
    const content = [
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"first line"}]}}',
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"second line"}]}}',
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"last line of output"}]}}',
    ].join('\n');
    expect(parseLastLogLine(content)).toBe('last line of output');
  });

  it('returns null when no assistant text found', () => {
    const content = '{"type":"tool_use","name":"read"}\n';
    expect(parseLastLogLine(content)).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(parseLastLogLine('')).toBeNull();
  });

  it('extracts text from flat text entries too', () => {
    const content = [
      '{"type":"text","text":"some output here"}',
      '{"type":"tool_use","name":"bash"}',
    ].join('\n');
    expect(parseLastLogLine(content)).toBe('some output here');
  });

  it('truncates long lines to specified width', () => {
    const longText = 'a'.repeat(200);
    const content = `{"type":"text","text":"${longText}"}\n`;
    const result = parseLastLogLine(content, 80);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(80);
    expect(result!.endsWith('…')).toBe(true);
  });

  it('does not truncate lines within width', () => {
    const content = '{"type":"text","text":"short line"}\n';
    expect(parseLastLogLine(content, 80)).toBe('short line');
  });

  it('strips markdown formatting', () => {
    const content = '{"type":"text","text":"**bold** and _italic_ text"}\n';
    expect(parseLastLogLine(content)).toBe('bold and italic text');
  });
});

describe('readLogTail', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ralph-tail-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads the tail of a log file', async () => {
    const logPath = join(dir, 'test.jsonl');
    const lines = Array.from({ length: 100 }, (_, i) => `{"line":${i}}`);
    await writeFile(logPath, lines.join('\n'));
    const content = await readLogTail(logPath, 512);
    expect(content.length).toBeLessThanOrEqual(512 + 200);
    expect(content).toContain('"line":99');
  });

  it('reads the entire file when smaller than maxBytes', async () => {
    const logPath = join(dir, 'small.jsonl');
    await writeFile(logPath, '{"line":0}\n{"line":1}\n');
    const content = await readLogTail(logPath, 8192);
    expect(content).toContain('"line":0');
    expect(content).toContain('"line":1');
  });

  it('returns empty string for nonexistent file', async () => {
    const result = await readLogTail(join(dir, 'nope.jsonl'));
    expect(result).toBe('');
  });
});

describe('formatElapsed', () => {
  it('formats seconds', () => {
    expect(formatElapsed(30_000)).toBe('30s ago');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsed(135_000)).toBe('2m 15s ago');
  });

  it('formats hours', () => {
    expect(formatElapsed(3_661_000)).toBe('1h 1m ago');
  });

  it('handles zero', () => {
    expect(formatElapsed(0)).toBe('0s ago');
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
      currentPhaseStarted: null,
      lastLogLine: null,
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
      currentPhaseStarted: null,
      lastLogLine: null,
    });
    expect(output).toContain('STOPPED');
    expect(output).toContain('10/10');
    expect(output).not.toContain('Phase');
  });

  it('shows current phase with elapsed time', () => {
    const twoMinutesAgo = new Date(Date.now() - 135_000);
    const output = formatMonitorOutput({
      status: 'RUNNING',
      done: 3,
      total: 10,
      currentTaskId: 'T-004',
      currentTaskTitle: 'Some task',
      phases: ['Boot', 'Red', 'Green'],
      currentPhaseStarted: twoMinutesAgo,
      lastLogLine: null,
    });
    expect(output).toContain('Current phase: Green');
    expect(output).toMatch(/\d+[ms].*ago/);
  });

  it('shows current phase without time when timestamp is null', () => {
    const output = formatMonitorOutput({
      status: 'RUNNING',
      done: 3,
      total: 10,
      currentTaskId: 'T-004',
      currentTaskTitle: 'Some task',
      phases: ['Boot', 'Red'],
      currentPhaseStarted: null,
      lastLogLine: null,
    });
    expect(output).not.toContain('Current phase');
  });

  it('shows last log line', () => {
    const output = formatMonitorOutput({
      status: 'RUNNING',
      done: 3,
      total: 10,
      currentTaskId: 'T-004',
      currentTaskTitle: 'Some task',
      phases: ['Boot'],
      currentPhaseStarted: null,
      lastLogLine: 'Writing test file...',
    });
    expect(output).toContain('Last output: Writing test file...');
  });

  it('does not show last log line when null', () => {
    const output = formatMonitorOutput({
      status: 'RUNNING',
      done: 3,
      total: 10,
      currentTaskId: 'T-004',
      currentTaskTitle: 'Some task',
      phases: ['Boot'],
      currentPhaseStarted: null,
      lastLogLine: null,
    });
    expect(output).not.toContain('Last output');
  });
});

describe('ralph monitor (run)', () => {
  let dir: string;
  let logsDir: string;
  let tasksDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let clearSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ralph-monitor-test-'));
    logsDir = join(dir, '.ralph-logs');
    tasksDir = join(dir, 'docs', 'tasks');
    await mkdir(logsDir, { recursive: true });
    await mkdir(tasksDir, { recursive: true });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    clearSpy.mockRestore();
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

  it('clears the screen on initial render in watch mode', async () => {
    vi.useFakeTimers();

    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: Task\n\n- **Status**: DONE\n- **Milestone**: 1 — Setup\n- **Depends**: none\n- **PRD Reference**: §1\n\n## Description\n\nDone.\n`,
    );

    const result: RunResult = await run(['-w', '-i', '1'], dir);

    // Initial render should clear the screen
    expect(clearSpy).toHaveBeenCalledTimes(1);

    result.stop!();
    vi.useRealTimers();
  });

  it('does not clear the screen in non-watch mode', async () => {
    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: Task\n\n- **Status**: DONE\n- **Milestone**: 1 — Setup\n- **Depends**: none\n- **PRD Reference**: §1\n\n## Description\n\nDone.\n`,
    );

    await run([], dir);

    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('renderDashboard returns formatted output for display', async () => {
    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: First task\n\n- **Status**: DONE\n- **Milestone**: 1 — Setup\n- **Depends**: none\n- **PRD Reference**: §1\n\n## Description\n\nDone.\n`,
    );
    await writeFile(
      join(tasksDir, 'T-002.md'),
      `# T-002: Second task\n\n- **Status**: TODO\n- **Milestone**: 1 — Setup\n- **Depends**: T-001\n- **PRD Reference**: §2\n\n## Description\n\nPending.\n`,
    );

    const output = await renderDashboard(tasksDir, logsDir);
    expect(output).toContain('1/2');
    expect(output).toContain('50%');
  });

  it('renderDashboard returns error message for missing tasks dir', async () => {
    const output = await renderDashboard(join(dir, 'nonexistent'), logsDir);
    expect(output).toBe('No tasks directory found');
  });
});
