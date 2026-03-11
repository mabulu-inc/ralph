import { describe, it, expect } from 'vitest';
import { defaultBootPromptTemplate } from '../templates/boot-prompt.js';

describe('defaultBootPromptTemplate', () => {
  it('returns a non-empty string', () => {
    const template = defaultBootPromptTemplate();
    expect(template.length).toBeGreaterThan(0);
  });

  it('contains task variable placeholders', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{task.id}}');
    expect(template).toContain('{{task.title}}');
    expect(template).toContain('{{task.description}}');
    expect(template).toContain('{{task.prdReference}}');
  });

  it('contains config variable placeholders', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{config.language}}');
    expect(template).toContain('{{config.packageManager}}');
    expect(template).toContain('{{config.testingFramework}}');
    expect(template).toContain('{{config.qualityCheck}}');
    expect(template).toContain('{{config.testCommand}}');
  });

  it('contains optional config placeholders', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{config.fileNaming}}');
    expect(template).toContain('{{config.database}}');
  });

  it('contains {{project.rules}} placeholder', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{project.rules}}');
  });

  it('contains CURRENT TASK section with already-selected note', () => {
    const template = defaultBootPromptTemplate();
    const currentTaskIdx = template.indexOf('CURRENT TASK');
    expect(currentTaskIdx).toBeGreaterThan(-1);
    const afterCurrentTask = template.substring(currentTaskIdx, currentTaskIdx + 300);
    expect(afterCurrentTask.toLowerCase()).toMatch(/already selected|do not.*scan/i);
  });

  it('contains file scoping with {{task.touches}} placeholder', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{task.touches}}');
  });

  it('contains {{codebaseIndex}} placeholder', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{codebaseIndex}}');
  });

  it('contains {{retryContext}} placeholder', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{retryContext}}');
  });

  it('contains PROJECT CONFIG section', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('PROJECT CONFIG');
  });

  it('does NOT contain stable methodology content (moved to system prompt)', () => {
    const template = defaultBootPromptTemplate();
    // Phase logging, tool usage rules, bash timeouts, anti-patterns
    // are now in the system prompt template
    expect(template).not.toContain('[PHASE]');
    expect(template).not.toContain('ANTI-PATTERNS');
    expect(template).not.toContain('120000ms');
    expect(template).not.toContain('Read tool');
  });
});
