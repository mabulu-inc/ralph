import { describe, it, expect } from 'vitest';
import { claudeProvider } from '../providers/claude.js';

describe('claudeProvider', () => {
  it('has correct binary name', () => {
    expect(claudeProvider.binary).toBe('claude');
  });

  it('has stream-json output format', () => {
    expect(claudeProvider.outputFormat).toEqual(['--output-format', 'stream-json']);
  });

  it('supports max turns', () => {
    expect(claudeProvider.supportsMaxTurns).toBe(true);
  });

  it('builds args for a basic prompt', () => {
    const args = claudeProvider.buildArgs('do something', {
      outputFormat: claudeProvider.outputFormat,
    });

    expect(args).toEqual([
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--dangerously-skip-permissions',
      '-p',
      'do something',
    ]);
  });

  it('builds args with max turns', () => {
    const args = claudeProvider.buildArgs('task', {
      outputFormat: claudeProvider.outputFormat,
      maxTurns: 75,
    });

    expect(args).toContain('--max-turns');
    expect(args).toContain('75');
    const maxTurnsIndex = args.indexOf('--max-turns');
    expect(args[maxTurnsIndex + 1]).toBe('75');
  });

  it('builds args with model override', () => {
    const args = claudeProvider.buildArgs('task', {
      outputFormat: claudeProvider.outputFormat,
      model: 'claude-opus-4-20250514',
    });

    expect(args).toContain('--model');
    expect(args).toContain('claude-opus-4-20250514');
  });

  it('builds args with both max turns and model', () => {
    const args = claudeProvider.buildArgs('task', {
      outputFormat: claudeProvider.outputFormat,
      maxTurns: 100,
      model: 'claude-sonnet-4-20250514',
    });

    expect(args).toContain('--max-turns');
    expect(args).toContain('100');
    expect(args).toContain('--model');
    expect(args).toContain('claude-sonnet-4-20250514');
  });

  it('omits max turns when not provided', () => {
    const args = claudeProvider.buildArgs('task', {
      outputFormat: claudeProvider.outputFormat,
    });

    expect(args).not.toContain('--max-turns');
  });

  it('omits model when not provided', () => {
    const args = claudeProvider.buildArgs('task', {
      outputFormat: claudeProvider.outputFormat,
    });

    expect(args).not.toContain('--model');
  });

  it('parseOutput returns raw output unchanged', () => {
    expect(claudeProvider.parseOutput('some output')).toBe('some output');
  });

  it('supports system prompt', () => {
    expect(claudeProvider.supportsSystemPrompt).toBe(true);
  });

  it('has --system-prompt flag', () => {
    expect(claudeProvider.systemPromptFlag).toBe('--system-prompt');
  });

  it('builds args with system prompt when provided', () => {
    const args = claudeProvider.buildArgs('user prompt', {
      outputFormat: claudeProvider.outputFormat,
      systemPrompt: 'system rules',
    });

    expect(args).toContain('--system-prompt');
    const flagIdx = args.indexOf('--system-prompt');
    expect(args[flagIdx + 1]).toBe('system rules');
    expect(args).toContain('-p');
    const pIdx = args.indexOf('-p');
    expect(args[pIdx + 1]).toBe('user prompt');
  });

  it('omits system prompt flag when not provided', () => {
    const args = claudeProvider.buildArgs('user prompt', {
      outputFormat: claudeProvider.outputFormat,
    });

    expect(args).not.toContain('--system-prompt');
  });
});
