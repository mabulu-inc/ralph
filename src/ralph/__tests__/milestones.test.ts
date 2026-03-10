import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run, generateMilestones } from '../commands/milestones.js';

describe('generateMilestones', () => {
  it('groups tasks by milestone in order of first appearance', () => {
    const tasks = [
      { id: 'T-000', status: 'DONE', milestone: '1 — Setup', title: 'Bootstrap', cost: '$1.00' },
      { id: 'T-001', status: 'DONE', milestone: '2 — Core', title: 'Parser', cost: '$5.00' },
      { id: 'T-002', status: 'TODO', milestone: '1 — Setup', title: 'Config', cost: undefined },
      { id: 'T-003', status: 'TODO', milestone: '2 — Core', title: 'Commands', cost: undefined },
    ];

    const md = generateMilestones(tasks as Parameters<typeof generateMilestones>[0]);

    expect(md).toContain('# Milestones');
    // Milestone 1 should come before Milestone 2 (first appearance order)
    const idx1 = md.indexOf('## 1 — Setup');
    const idx2 = md.indexOf('## 2 — Core');
    expect(idx1).toBeLessThan(idx2);
  });

  it('renders checkboxes based on task status', () => {
    const tasks = [
      { id: 'T-000', status: 'DONE', milestone: '1 — Setup', title: 'Bootstrap', cost: '$1.00' },
      { id: 'T-001', status: 'TODO', milestone: '1 — Setup', title: 'Config', cost: undefined },
    ];

    const md = generateMilestones(tasks as Parameters<typeof generateMilestones>[0]);

    expect(md).toContain('- [x] T-000: Bootstrap — $1.00');
    expect(md).toContain('- [ ] T-001: Config');
  });

  it('includes per-milestone cost rollup in heading', () => {
    const tasks = [
      { id: 'T-000', status: 'DONE', milestone: '1 — Setup', title: 'Bootstrap', cost: '$1.50' },
      { id: 'T-001', status: 'DONE', milestone: '1 — Setup', title: 'Config', cost: '$2.50' },
    ];

    const md = generateMilestones(tasks as Parameters<typeof generateMilestones>[0]);

    expect(md).toContain('## 1 — Setup ($4.00)');
  });

  it('includes grand total at the end', () => {
    const tasks = [
      { id: 'T-000', status: 'DONE', milestone: '1 — Setup', title: 'Bootstrap', cost: '$1.00' },
      { id: 'T-001', status: 'DONE', milestone: '2 — Core', title: 'Parser', cost: '$5.00' },
    ];

    const md = generateMilestones(tasks as Parameters<typeof generateMilestones>[0]);

    expect(md).toContain('**Grand Total: $6.00**');
  });

  it('handles milestones with no cost (all TODO tasks)', () => {
    const tasks = [
      { id: 'T-000', status: 'TODO', milestone: '1 — Setup', title: 'Bootstrap', cost: undefined },
    ];

    const md = generateMilestones(tasks as Parameters<typeof generateMilestones>[0]);

    expect(md).toContain('## 1 — Setup');
    // No cost in heading when all costs are zero/undefined
    expect(md).not.toContain('## 1 — Setup ($');
  });

  it('does not append cost to TODO task lines', () => {
    const tasks = [
      { id: 'T-000', status: 'TODO', milestone: '1 — Setup', title: 'Bootstrap', cost: undefined },
    ];

    const md = generateMilestones(tasks as Parameters<typeof generateMilestones>[0]);

    expect(md).toContain('- [ ] T-000: Bootstrap');
    expect(md).not.toContain('- [ ] T-000: Bootstrap —');
  });

  it('handles empty task list', () => {
    const md = generateMilestones([]);

    expect(md).toContain('# Milestones');
    expect(md).toContain('**Grand Total: $0.00**');
  });

  it('handles mixed costs with some undefined', () => {
    const tasks = [
      { id: 'T-000', status: 'DONE', milestone: '1 — Setup', title: 'A', cost: '$3.00' },
      { id: 'T-001', status: 'DONE', milestone: '1 — Setup', title: 'B', cost: undefined },
    ];

    const md = generateMilestones(tasks as Parameters<typeof generateMilestones>[0]);

    expect(md).toContain('## 1 — Setup ($3.00)');
    expect(md).toContain('- [x] T-000: A — $3.00');
    expect(md).toContain('- [x] T-001: B');
  });
});

describe('ralph milestones (run)', () => {
  let dir: string;
  let tasksDir: string;
  let logSpy: ReturnType<typeof import('vitest').vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ralph-milestones-test-'));
    tasksDir = join(dir, 'docs', 'tasks');
    await mkdir(tasksDir, { recursive: true });
    logSpy = (await import('vitest')).vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await rm(dir, { recursive: true, force: true });
  });

  it('writes MILESTONES.md to the docs directory', async () => {
    await writeFile(
      join(tasksDir, 'T-000.md'),
      `# T-000: Bootstrap

- **Status**: DONE
- **Milestone**: 1 — Setup
- **Depends**: none
- **PRD Reference**: §0
- **Completed**: 2026-03-10 10:00 (5m duration)
- **Cost**: $2.00

## Description

Bootstrap the project.
`,
    );

    await run([], dir);

    const milestonesPath = join(dir, 'docs', 'MILESTONES.md');
    const content = await readFile(milestonesPath, 'utf-8');
    expect(content).toContain('# Milestones');
    expect(content).toContain('## 1 — Setup ($2.00)');
    expect(content).toContain('- [x] T-000: Bootstrap — $2.00');
  });

  it('reports the file was written', async () => {
    await writeFile(
      join(tasksDir, 'T-000.md'),
      `# T-000: Bootstrap

- **Status**: TODO
- **Milestone**: 1 — Setup
- **Depends**: none
- **PRD Reference**: §0

## Description

Bootstrap.
`,
    );

    await run([], dir);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MILESTONES.md'));
  });

  it('handles multiple milestones and tasks', async () => {
    await writeFile(
      join(tasksDir, 'T-000.md'),
      `# T-000: Bootstrap

- **Status**: DONE
- **Milestone**: 1 — Setup
- **Depends**: none
- **PRD Reference**: §0
- **Cost**: $1.00

## Description

Bootstrap.
`,
    );

    await writeFile(
      join(tasksDir, 'T-001.md'),
      `# T-001: Parser

- **Status**: DONE
- **Milestone**: 2 — Core
- **Depends**: T-000
- **PRD Reference**: §1
- **Cost**: $5.96

## Description

Parse tasks.
`,
    );

    await writeFile(
      join(tasksDir, 'T-002.md'),
      `# T-002: CLI

- **Status**: TODO
- **Milestone**: 2 — Core
- **Depends**: T-001
- **PRD Reference**: §1

## Description

Build CLI.
`,
    );

    await run([], dir);

    const content = await readFile(join(dir, 'docs', 'MILESTONES.md'), 'utf-8');
    expect(content).toContain('## 1 — Setup ($1.00)');
    expect(content).toContain('## 2 — Core ($5.96)');
    expect(content).toContain('- [x] T-000: Bootstrap — $1.00');
    expect(content).toContain('- [x] T-001: Parser — $5.96');
    expect(content).toContain('- [ ] T-002: CLI');
    expect(content).toContain('**Grand Total: $6.96**');
  });
});
