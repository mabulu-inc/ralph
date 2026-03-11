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

  it('contains phase logging instructions', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('[PHASE]');
    expect(template).toContain('Boot');
    expect(template).toContain('Red');
    expect(template).toContain('Green');
    expect(template).toContain('Verify');
    expect(template).toContain('Commit');
  });

  it('contains TDD methodology instructions', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('red');
    expect(template).toContain('green');
    expect(template).toContain('TDD');
  });

  it('contains quality gate instructions', () => {
    const template = defaultBootPromptTemplate();
    expect(template.toLowerCase()).toContain('quality');
  });

  it('contains one-commit-per-task rule', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('ONE commit per task');
  });

  it('contains tool usage rules', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('Read tool');
    expect(template).toContain('Grep');
  });

  it('contains bash timeout guidance', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('120000ms');
    expect(template).toContain('120 seconds');
  });

  it('contains commit message format', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('T-NNN:');
  });

  it('contains {{project.rules}} placeholder', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{project.rules}}');
  });

  it('places {{project.rules}} after PROJECT CONFIG and before WORKFLOW', () => {
    const template = defaultBootPromptTemplate();
    const configIdx = template.indexOf('PROJECT CONFIG');
    const rulesIdx = template.indexOf('{{project.rules}}');
    const workflowIdx = template.indexOf('WORKFLOW:');
    expect(configIdx).toBeLessThan(rulesIdx);
    expect(rulesIdx).toBeLessThan(workflowIdx);
  });

  it('contains task re-discovery prevention instruction', () => {
    const template = defaultBootPromptTemplate();
    // The prompt must tell the agent that the task has already been selected
    expect(template.toLowerCase()).toContain('already selected');
    // Must discourage scanning task files
    expect(template.toLowerCase()).toMatch(/do not.*(scan|re-discover)/i);
  });

  it('contains file scoping with {{task.touches}} placeholder', () => {
    const template = defaultBootPromptTemplate();
    expect(template).toContain('{{task.touches}}');
  });

  it('contains read budget guideline', () => {
    const template = defaultBootPromptTemplate();
    // Must encourage starting tests within a bounded number of tool calls
    expect(template).toContain('10 tool calls');
  });

  it('contains targeted verification guidance', () => {
    const template = defaultBootPromptTemplate();
    // Should instruct running only relevant tests during TDD, full check at end
    expect(template.toLowerCase()).toMatch(/relevant test/i);
  });

  it('contains commit phase batching guidance', () => {
    const template = defaultBootPromptTemplate();
    // Should instruct minimizing tool calls during commit
    expect(template.toLowerCase()).toMatch(/single edit/i);
    // Should mention not re-reading the task file after editing
    expect(template.toLowerCase()).toMatch(/do not re-read/i);
  });

  it('contains command output hygiene guidance', () => {
    const template = defaultBootPromptTemplate();
    // Should mention quiet/silent flags
    expect(template.toLowerCase()).toMatch(/quiet|silent/i);
  });

  it('contains anti-patterns section', () => {
    const template = defaultBootPromptTemplate();
    const antiIdx = template.indexOf('ANTI-PATTERNS');
    expect(antiIdx).toBeGreaterThan(-1);
  });

  it('lists known anti-patterns from log analysis', () => {
    const template = defaultBootPromptTemplate();
    // After running formatters, re-read modified files
    expect(template.toLowerCase()).toContain('formatter');
    // Semantic test assertions, not string-matching
    expect(template.toLowerCase()).toContain('semantic');
    // Do not amend commits to add SHA
    expect(template.toLowerCase()).toContain('amend');
  });

  it('places ANTI-PATTERNS after WORKFLOW section', () => {
    const template = defaultBootPromptTemplate();
    const workflowIdx = template.indexOf('WORKFLOW:');
    const antiIdx = template.indexOf('ANTI-PATTERNS');
    expect(workflowIdx).toBeLessThan(antiIdx);
  });

  it('contains CURRENT TASK section with already-selected note', () => {
    const template = defaultBootPromptTemplate();
    const currentTaskIdx = template.indexOf('CURRENT TASK');
    expect(currentTaskIdx).toBeGreaterThan(-1);
    // The already-selected note should be near CURRENT TASK
    const afterCurrentTask = template.substring(currentTaskIdx, currentTaskIdx + 300);
    expect(afterCurrentTask.toLowerCase()).toMatch(/already selected|do not.*scan/i);
  });
});
