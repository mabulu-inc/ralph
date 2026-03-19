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

  it('contains only the {{roles}} template variable for dynamic injection', () => {
    const template = defaultSystemPromptTemplate();
    // The only template variable should be {{roles}} for dynamic role injection
    expect(template).toContain('{{roles}}');
    // No other template variables should be present
    const matches = template.match(/\{\{.*?\}\}/g) ?? [];
    expect(matches).toEqual(['{{roles}}']);
  });

  it('contains complete ONE task then STOP instruction', () => {
    const template = defaultSystemPromptTemplate();
    expect(template).toContain('Complete ONE task, then STOP');
  });

  describe('agent roles (§9)', () => {
    it('contains a {{roles}} placeholder for dynamic role injection', () => {
      const template = defaultSystemPromptTemplate();
      expect(template).toContain('{{roles}}');
    });

    it('includes Boot phase participation rules from §9.2', () => {
      const template = defaultSystemPromptTemplate();
      expect(template.toLowerCase()).toContain('boot');
      // Boot gate roles
      expect(template).toContain('pre-implementation gate');
    });

    it('includes Verify phase participation rules from §9.2', () => {
      const template = defaultSystemPromptTemplate();
      expect(template).toContain('pre-commit gate');
    });

    it('requires [ROLE: ...] attributed commentary format from §9.3', () => {
      const template = defaultSystemPromptTemplate();
      expect(template).toContain('[ROLE:');
    });

    it('includes SDET TDD compliance audit criteria from §9.4', () => {
      const template = defaultSystemPromptTemplate();
      expect(template).toContain('TDD compliance');
      expect(template.toLowerCase()).toContain('test-first');
    });

    it('instructs non-applicable roles to explicitly skip with a reason', () => {
      const template = defaultSystemPromptTemplate();
      expect(template.toLowerCase()).toContain('skip');
      expect(template).toContain('reason');
    });

    it('requires all applicable roles to produce commentary before proceeding', () => {
      const template = defaultSystemPromptTemplate();
      expect(template.toLowerCase()).toContain('commentary');
    });
  });
});
