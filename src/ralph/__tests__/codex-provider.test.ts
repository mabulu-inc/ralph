import { describe, it, expect } from 'vitest';
import { codexProvider } from '../providers/codex.js';

describe('codexProvider', () => {
  it('has correct binary name', () => {
    expect(codexProvider.binary).toBe('codex');
  });

  it('has json output format', () => {
    expect(codexProvider.outputFormat).toEqual(['--json']);
  });

  it('does not support max turns', () => {
    expect(codexProvider.supportsMaxTurns).toBe(false);
  });

  it('has correct instructions file', () => {
    expect(codexProvider.instructionsFile).toBe('AGENTS.md');
  });

  it('builds args with exec subcommand and prompt as positional argument', () => {
    const args = codexProvider.buildArgs('do something', {
      outputFormat: codexProvider.outputFormat,
    });

    expect(args).toEqual(['exec', '--json', 'do something']);
  });

  it('builds args with model override', () => {
    const args = codexProvider.buildArgs('task', {
      outputFormat: codexProvider.outputFormat,
      model: 'o4-mini',
    });

    expect(args).toContain('--model');
    expect(args).toContain('o4-mini');
    expect(args[0]).toBe('exec');
  });

  it('ignores max turns even when provided', () => {
    const args = codexProvider.buildArgs('task', {
      outputFormat: codexProvider.outputFormat,
      maxTurns: 75,
    });

    expect(args).not.toContain('--max-turns');
    expect(args).not.toContain('75');
  });

  it('omits model when not provided', () => {
    const args = codexProvider.buildArgs('task', {
      outputFormat: codexProvider.outputFormat,
    });

    expect(args).not.toContain('--model');
  });

  it('parseOutput returns raw output unchanged', () => {
    expect(codexProvider.parseOutput('some output')).toBe('some output');
  });

  it('does not support system prompt', () => {
    expect(codexProvider.supportsSystemPrompt).toBe(false);
  });

  it('has empty system prompt flag', () => {
    expect(codexProvider.systemPromptFlag).toBe('');
  });
});
