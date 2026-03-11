import { describe, it, expect } from 'vitest';
import { cursorProvider } from '../providers/cursor.js';

describe('cursorProvider', () => {
  it('has correct binary name', () => {
    expect(cursorProvider.binary).toBe('cursor');
  });

  it('has stream-json output format', () => {
    expect(cursorProvider.outputFormat).toEqual(['--output-format', 'stream-json']);
  });

  it('does not support max turns', () => {
    expect(cursorProvider.supportsMaxTurns).toBe(false);
  });

  it('has correct instructions file', () => {
    expect(cursorProvider.instructionsFile).toBe('.cursor/rules/');
  });

  it('builds args for a basic prompt', () => {
    const args = cursorProvider.buildArgs('do something', {
      outputFormat: cursorProvider.outputFormat,
    });

    expect(args).toEqual(['-p', '--output-format', 'stream-json', 'do something']);
  });

  it('builds args with model override', () => {
    const args = cursorProvider.buildArgs('task', {
      outputFormat: cursorProvider.outputFormat,
      model: 'gpt-4o',
    });

    expect(args).toContain('--model');
    expect(args).toContain('gpt-4o');
  });

  it('ignores max turns even when provided', () => {
    const args = cursorProvider.buildArgs('task', {
      outputFormat: cursorProvider.outputFormat,
      maxTurns: 75,
    });

    expect(args).not.toContain('--max-turns');
    expect(args).not.toContain('75');
  });

  it('omits model when not provided', () => {
    const args = cursorProvider.buildArgs('task', {
      outputFormat: cursorProvider.outputFormat,
    });

    expect(args).not.toContain('--model');
  });

  it('parseOutput returns raw output unchanged', () => {
    expect(cursorProvider.parseOutput('some output')).toBe('some output');
  });
});
