import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseSessionResult } from '../core/jsonl-result.js';

describe('parseSessionResult', () => {
  let tmpDir: string;

  async function setup() {
    tmpDir = await mkdtemp(join(tmpdir(), 'ralph-jsonl-test-'));
  }

  async function cleanup() {
    await rm(tmpDir, { recursive: true, force: true });
  }

  it('extracts error_max_turns result', async () => {
    await setup();
    try {
      const logFile = join(tmpDir, 'test.jsonl');
      const lines = [
        JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } }),
        JSON.stringify({
          type: 'result',
          subtype: 'error_max_turns',
          num_turns: 75,
          stop_reason: 'max_turns',
        }),
      ];
      await writeFile(logFile, lines.join('\n') + '\n');

      const result = await parseSessionResult(logFile);
      expect(result).toEqual({
        subtype: 'error_max_turns',
        numTurns: 75,
        stopReason: 'max_turns',
      });
    } finally {
      await cleanup();
    }
  });

  it('extracts successful result with num_turns', async () => {
    await setup();
    try {
      const logFile = join(tmpDir, 'test.jsonl');
      const lines = [
        JSON.stringify({ type: 'assistant', message: { content: [] } }),
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          num_turns: 42,
          stop_reason: 'end_turn',
        }),
      ];
      await writeFile(logFile, lines.join('\n') + '\n');

      const result = await parseSessionResult(logFile);
      expect(result).toEqual({
        subtype: 'success',
        numTurns: 42,
        stopReason: 'end_turn',
      });
    } finally {
      await cleanup();
    }
  });

  it('returns undefined when no result entry exists', async () => {
    await setup();
    try {
      const logFile = join(tmpDir, 'test.jsonl');
      await writeFile(
        logFile,
        JSON.stringify({ type: 'assistant', message: { content: [] } }) + '\n',
      );

      const result = await parseSessionResult(logFile);
      expect(result).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it('returns undefined when log file does not exist', async () => {
    await setup();
    try {
      const result = await parseSessionResult(join(tmpDir, 'nonexistent.jsonl'));
      expect(result).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it('handles empty file', async () => {
    await setup();
    try {
      const logFile = join(tmpDir, 'empty.jsonl');
      await writeFile(logFile, '');

      const result = await parseSessionResult(logFile);
      expect(result).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it('handles malformed JSON lines gracefully', async () => {
    await setup();
    try {
      const logFile = join(tmpDir, 'bad.jsonl');
      const lines = ['not json', '{"type":"result","subtype":"success","num_turns":10}'];
      await writeFile(logFile, lines.join('\n') + '\n');

      const result = await parseSessionResult(logFile);
      expect(result).toEqual({
        subtype: 'success',
        numTurns: 10,
        stopReason: undefined,
      });
    } finally {
      await cleanup();
    }
  });

  it('uses the last result entry when multiple exist', async () => {
    await setup();
    try {
      const logFile = join(tmpDir, 'multi.jsonl');
      const lines = [
        JSON.stringify({ type: 'result', subtype: 'error', num_turns: 5 }),
        JSON.stringify({ type: 'result', subtype: 'success', num_turns: 42 }),
      ];
      await writeFile(logFile, lines.join('\n') + '\n');

      const result = await parseSessionResult(logFile);
      expect(result?.subtype).toBe('success');
      expect(result?.numTurns).toBe(42);
    } finally {
      await cleanup();
    }
  });
});
