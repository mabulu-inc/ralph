import { describe, it, expect } from 'vitest';
import { defaultSystemPromptTemplate } from '../templates/system-prompt.js';

describe('defaultSystemPromptTemplate', () => {
  it('returns a non-empty string', () => {
    const template = defaultSystemPromptTemplate();
    expect(template.length).toBeGreaterThan(0);
  });

  it('contains phase logging instructions', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).toContain('[PHASE]');
    expect(template).toContain('Boot');
    expect(template).toContain('Red');
    expect(template).toContain('Green');
    expect(template).toContain('Verify');
    expect(template).toContain('Commit');
  });

  it('contains TDD methodology instructions', () => {
    const template = defaultSystemPromptTemplate();
    expect(template.toLowerCase()).toContain('tdd');
    expect(template.toLowerCase()).toContain('red');
    expect(template.toLowerCase()).toContain('green');
  });

  it('contains quality gate instructions', () => {
    const template = defaultSystemPromptTemplate();
    expect(template.toLowerCase()).toContain('quality');
  });

  it('contains one-commit-per-task rule', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).toContain('ONE commit per task');
  });

  it('contains tool usage rules', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).toContain('Read tool');
    expect(template).toContain('Grep');
  });

  it('contains bash timeout guidance', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).toContain('120000ms');
    expect(template).toContain('120 seconds');
  });

  it('contains anti-patterns section', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).toContain('ANTI-PATTERNS');
  });

  it('contains command output hygiene guidance', () => {
    const template = defaultSystemPromptTemplate();
    expect(template.toLowerCase()).toMatch(/quiet|silent/i);
  });

  it('does NOT contain any template variables', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).not.toMatch(/\{\{.*?\}\}/);
  });

  it('contains complete ONE task then STOP instruction', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).toContain('Complete ONE task, then STOP');
  });
});
