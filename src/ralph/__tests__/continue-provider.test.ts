import { describe, it, expect } from 'vitest';
import { continueProvider } from '../providers/continue.js';

describe('continueProvider', () => {
  it('has correct binary name', () => {
    expect(continueProvider.binary).toBe('cn');
  });

  it('has stream-json output format', () => {
    expect(continueProvider.outputFormat).toEqual(['--output-format', 'stream-json']);
  });

  it('supports max turns', () => {
    expect(continueProvider.supportsMaxTurns).toBe(true);
  });

  it('has correct instructions file', () => {
    expect(continueProvider.instructionsFile).toBe('~/.continue/config.yaml');
  });

  it('builds args for a basic prompt', () => {
    const args = continueProvider.buildArgs('do something', {
      outputFormat: continueProvider.outputFormat,
    });

    expect(args).toEqual(['-p', '--output-format', 'stream-json', 'do something']);
  });

  it('builds args with max turns', () => {
    const args = continueProvider.buildArgs('task', {
      outputFormat: continueProvider.outputFormat,
      maxTurns: 75,
    });

    expect(args).toContain('--max-turns');
    expect(args).toContain('75');
    const maxTurnsIndex = args.indexOf('--max-turns');
    expect(args[maxTurnsIndex + 1]).toBe('75');
  });

  it('builds args with model override', () => {
    const args = continueProvider.buildArgs('task', {
      outputFormat: continueProvider.outputFormat,
      model: 'gpt-4o',
    });

    expect(args).toContain('--model');
    expect(args).toContain('gpt-4o');
  });

  it('builds args with both max turns and model', () => {
    const args = continueProvider.buildArgs('task', {
      outputFormat: continueProvider.outputFormat,
      maxTurns: 100,
      model: 'gpt-4o',
    });

    expect(args).toContain('--max-turns');
    expect(args).toContain('100');
    expect(args).toContain('--model');
    expect(args).toContain('gpt-4o');
  });

  it('omits max turns when not provided', () => {
    const args = continueProvider.buildArgs('task', {
      outputFormat: continueProvider.outputFormat,
    });

    expect(args).not.toContain('--max-turns');
  });

  it('omits model when not provided', () => {
    const args = continueProvider.buildArgs('task', {
      outputFormat: continueProvider.outputFormat,
    });

    expect(args).not.toContain('--model');
  });

  it('parseOutput returns raw output unchanged', () => {
    expect(continueProvider.parseOutput('some output')).toBe('some output');
  });

  it('does not support system prompt', () => {
    expect(continueProvider.supportsSystemPrompt).toBe(false);
  });

  it('has empty system prompt flag', () => {
    expect(continueProvider.systemPromptFlag).toBe('');
  });
});
