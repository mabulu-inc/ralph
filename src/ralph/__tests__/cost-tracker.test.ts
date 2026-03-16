import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { calculateLogFileCost, calculateTaskCost } from '../core/cost-tracker.js';

const usageLine = (input: number, cacheWrite: number, cacheRead: number, output: number) =>
  JSON.stringify({
    type: 'result',
    usage: {
      input_tokens: input,
      cache_creation_input_tokens: cacheWrite,
      cache_read_input_tokens: cacheRead,
      output_tokens: output,
    },
  });

describe('calculateLogFileCost', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ralph-cost-tracker-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('calculates cost from a single log file', async () => {
    const logFile = join(dir, 'T-001-20260310-120000.jsonl');
    await writeFile(logFile, [usageLine(1_000_000, 0, 0, 0)].join('\n'));
    const cost = await calculateLogFileCost(logFile);
    // Input: $3/MTok → 1M tokens = $3.00
    expect(cost).toBeCloseTo(3.0);
  });

  it('returns 0 for empty log file', async () => {
    const logFile = join(dir, 'empty.jsonl');
    await writeFile(logFile, '');
    const cost = await calculateLogFileCost(logFile);
    expect(cost).toBe(0);
  });

  it('returns 0 for nonexistent log file', async () => {
    const cost = await calculateLogFileCost(join(dir, 'nope.jsonl'));
    expect(cost).toBe(0);
  });

  it('sums usage across multiple entries in one file', async () => {
    const logFile = join(dir, 'multi.jsonl');
    await writeFile(logFile, [usageLine(500_000, 0, 0, 0), usageLine(500_000, 0, 0, 0)].join('\n'));
    const cost = await calculateLogFileCost(logFile);
    expect(cost).toBeCloseTo(3.0);
  });
});

describe('calculateTaskCost', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ralph-cost-tracker-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('sums cost across all log files for a task', async () => {
    await writeFile(join(dir, 'T-001-20260310-120000.jsonl'), usageLine(1_000_000, 0, 0, 0));
    await writeFile(join(dir, 'T-001-20260310-130000.jsonl'), usageLine(1_000_000, 0, 0, 0));
    const cost = await calculateTaskCost(dir, 'T-001');
    expect(cost).toBeCloseTo(6.0);
  });

  it('does not include logs from other tasks', async () => {
    await writeFile(join(dir, 'T-001-20260310-120000.jsonl'), usageLine(1_000_000, 0, 0, 0));
    await writeFile(join(dir, 'T-002-20260310-120000.jsonl'), usageLine(5_000_000, 0, 0, 0));
    const cost = await calculateTaskCost(dir, 'T-001');
    expect(cost).toBeCloseTo(3.0);
  });

  it('returns 0 when no logs exist for the task', async () => {
    await writeFile(join(dir, 'T-002-20260310-120000.jsonl'), usageLine(1_000_000, 0, 0, 0));
    const cost = await calculateTaskCost(dir, 'T-001');
    expect(cost).toBe(0);
  });

  it('returns 0 when logs directory does not exist', async () => {
    const cost = await calculateTaskCost(join(dir, 'nonexistent'), 'T-001');
    expect(cost).toBe(0);
  });
});
