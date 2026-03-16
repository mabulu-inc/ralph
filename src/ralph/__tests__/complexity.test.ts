import { describe, expect, it } from 'vitest';
import { computeTaskComplexity } from '../core/complexity.js';
import type { Task } from '../core/tasks.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'T-099',
    number: 99,
    title: 'Test task',
    status: 'TODO',
    milestone: '1 — Test',
    depends: [],
    prdReference: '§1',
    completed: undefined,
    commit: undefined,
    cost: undefined,
    blocked: false,
    description: 'A simple task.',
    producesCount: 1,
    touches: [],
    hints: '',
    complexity: undefined,
    ...overrides,
  };
}

describe('computeTaskComplexity', () => {
  describe('light tier', () => {
    it('returns light for 0 deps, 1 produce, no keywords', () => {
      const task = makeTask({ depends: [], producesCount: 1 });
      expect(computeTaskComplexity(task)).toBe('light');
    });

    it('returns light for 1 dep, 2 produces, no keywords', () => {
      const task = makeTask({ depends: ['T-000'], producesCount: 2 });
      expect(computeTaskComplexity(task)).toBe('light');
    });
  });

  describe('standard tier', () => {
    it('returns standard for 2 deps', () => {
      const task = makeTask({ depends: ['T-000', 'T-001'], producesCount: 1 });
      expect(computeTaskComplexity(task)).toBe('standard');
    });

    it('returns standard for 3 deps', () => {
      const task = makeTask({ depends: ['T-000', 'T-001', 'T-002'], producesCount: 1 });
      expect(computeTaskComplexity(task)).toBe('standard');
    });

    it('returns standard for 3 produces', () => {
      const task = makeTask({ depends: [], producesCount: 3 });
      expect(computeTaskComplexity(task)).toBe('standard');
    });

    it('returns standard for 4 produces', () => {
      const task = makeTask({ depends: ['T-000'], producesCount: 4 });
      expect(computeTaskComplexity(task)).toBe('standard');
    });
  });

  describe('heavy tier', () => {
    it('returns heavy for 4+ deps', () => {
      const task = makeTask({
        depends: ['T-000', 'T-001', 'T-002', 'T-003'],
        producesCount: 1,
      });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('returns heavy for 5+ produces', () => {
      const task = makeTask({ depends: [], producesCount: 5 });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('returns heavy when title contains "integration"', () => {
      const task = makeTask({ title: 'End-to-end integration tests' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('returns heavy when title contains "end-to-end"', () => {
      const task = makeTask({ title: 'End-to-end tests' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('returns heavy when title contains "e2e"', () => {
      const task = makeTask({ title: 'E2E validation suite' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('returns heavy when title contains "refactor"', () => {
      const task = makeTask({ title: 'Refactor the database layer' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('returns heavy when description contains "integration"', () => {
      const task = makeTask({ description: 'This is an integration test task' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('returns heavy when description contains "e2e"', () => {
      const task = makeTask({ description: 'Run e2e tests against staging' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });
  });

  describe('keyword matching is case-insensitive', () => {
    it('matches INTEGRATION in title', () => {
      const task = makeTask({ title: 'INTEGRATION tests' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('matches Refactor in description', () => {
      const task = makeTask({ description: 'Refactor the parser module' });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });
  });

  describe('tier precedence', () => {
    it('heavy overrides standard (keyword + 2 deps)', () => {
      const task = makeTask({
        depends: ['T-000', 'T-001'],
        title: 'Integration test',
      });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });

    it('heavy from deps overrides standard from produces', () => {
      const task = makeTask({
        depends: ['T-000', 'T-001', 'T-002', 'T-003'],
        producesCount: 3,
      });
      expect(computeTaskComplexity(task)).toBe('heavy');
    });
  });
});
