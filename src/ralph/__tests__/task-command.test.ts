import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('task-scaffold template', () => {
  it('generates a task template with number and title interpolated', async () => {
    const { generateTaskScaffold } = await import('../templates/task-scaffold.js');
    const result = generateTaskScaffold({ number: 42, title: 'My cool feature' });

    expect(result).toContain('# T-042: My cool feature');
    expect(result).toContain('**Status**: TODO');
    expect(result).toContain('**Milestone**:');
    expect(result).toContain('**Depends**:');
    expect(result).toContain('**PRD Reference**:');
    expect(result).toContain('## Description');
    expect(result).toContain('## AC');
  });

  it('includes guidance comment about section handling', async () => {
    const { generateTaskScaffold } = await import('../templates/task-scaffold.js');
    const result = generateTaskScaffold({ number: 1, title: 'Test' });

    expect(result).toContain('<!-- Sections:');
    expect(result).toContain('ralph show task');
  });

  it('includes optional fields with placeholders', async () => {
    const { generateTaskScaffold } = await import('../templates/task-scaffold.js');
    const result = generateTaskScaffold({ number: 5, title: 'Test' });

    expect(result).toContain('Complexity');
    expect(result).toContain('Touches');
    expect(result).toContain('Roles');
  });

  it('pads task number to 3 digits', async () => {
    const { generateTaskScaffold } = await import('../templates/task-scaffold.js');
    const result = generateTaskScaffold({ number: 3, title: 'Padded' });
    expect(result).toContain('# T-003: Padded');
  });
});

describe('task command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ralph-task-test-'));
    await mkdir(join(tmpDir, 'docs', 'tasks'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a task file with the next available number', async () => {
    // Create existing tasks
    await writeFile(join(tmpDir, 'docs', 'tasks', 'T-001.md'), '# T-001: First\n');
    await writeFile(join(tmpDir, 'docs', 'tasks', 'T-003.md'), '# T-003: Third\n');

    const { run } = await import('../commands/task.js');
    const output = await run(['New feature'], tmpDir);

    expect(output).toContain('T-004.md');
    const content = await readFile(join(tmpDir, 'docs', 'tasks', 'T-004.md'), 'utf-8');
    expect(content).toContain('# T-004: New feature');
    expect(content).toContain('**Status**: TODO');
  });

  it('starts at T-001 when no tasks exist', async () => {
    const { run } = await import('../commands/task.js');
    const output = await run(['First task'], tmpDir);

    expect(output).toContain('T-001.md');
    const content = await readFile(join(tmpDir, 'docs', 'tasks', 'T-001.md'), 'utf-8');
    expect(content).toContain('# T-001: First task');
  });

  it('pre-fills fields from CLI flags', async () => {
    const { run } = await import('../commands/task.js');
    await run(
      [
        'Flagged task',
        '--depends',
        'T-010,T-011',
        '--complexity',
        'heavy',
        '--milestone',
        '3 — Auth',
        '--prd-ref',
        '§3.2, §3.3',
        '--touches',
        'src/auth.ts,src/login.ts',
        '--roles',
        'DBA,Security Engineer',
      ],
      tmpDir,
    );

    const content = await readFile(join(tmpDir, 'docs', 'tasks', 'T-001.md'), 'utf-8');
    expect(content).toContain('**Depends**: T-010, T-011');
    expect(content).toContain('**Complexity**: heavy');
    expect(content).toContain('**Milestone**: 3 — Auth');
    expect(content).toContain('**PRD Reference**: §3.2, §3.3');
    expect(content).toContain('**Touches**: `src/auth.ts`, `src/login.ts`');
    expect(content).toContain('**Roles**: DBA, Security Engineer');
  });

  it('dry-run prints to stdout without creating a file', async () => {
    const { run } = await import('../commands/task.js');
    const output = await run(['Dry run task', '--dry-run'], tmpDir);

    expect(output).toContain('# T-001: Dry run task');
    expect(output).toContain('**Status**: TODO');

    // Verify no file was created
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(join(tmpDir, 'docs', 'tasks'));
    expect(files.filter((f: string) => f.startsWith('T-'))).toHaveLength(0);
  });

  it('uses custom template from docs/prompts/task-template.md', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(
      join(tmpDir, 'docs', 'prompts', 'task-template.md'),
      '# {{task.number}}: {{task.title}}\n\nCustom template content\n',
    );

    const { run } = await import('../commands/task.js');
    await run(['Custom'], tmpDir);

    const content = await readFile(join(tmpDir, 'docs', 'tasks', 'T-001.md'), 'utf-8');
    expect(content).toContain('Custom template content');
    expect(content).toContain('# T-001: Custom');
  });

  it('warns if custom template is missing {{task.number}} placeholder', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(
      join(tmpDir, 'docs', 'prompts', 'task-template.md'),
      '# {{task.title}}\n\nMissing number placeholder\n',
    );

    const { run } = await import('../commands/task.js');
    const output = await run(['No number'], tmpDir);

    expect(output).toContain('Warning');
    expect(output).toContain('{{task.number}}');
  });

  it('warns if custom template is missing {{task.title}} placeholder', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(
      join(tmpDir, 'docs', 'prompts', 'task-template.md'),
      '# {{task.number}}: Hardcoded\n\nMissing title placeholder\n',
    );

    const { run } = await import('../commands/task.js');
    const output = await run(['No title'], tmpDir);

    expect(output).toContain('Warning');
    expect(output).toContain('{{task.title}}');
  });

  it('handles gaps in numbering by incrementing from highest', async () => {
    await writeFile(join(tmpDir, 'docs', 'tasks', 'T-010.md'), '# T-010: Ten\n');
    await writeFile(join(tmpDir, 'docs', 'tasks', 'T-050.md'), '# T-050: Fifty\n');
    // T-011 through T-049 are missing — should still use T-051

    const { run } = await import('../commands/task.js');
    const output = await run(['After gap'], tmpDir);

    expect(output).toContain('T-051.md');
  });

  it('prints created file path to stdout', async () => {
    const { run } = await import('../commands/task.js');
    const output = await run(['Path test'], tmpDir);

    expect(output).toContain('docs/tasks/T-001.md');
  });

  it('creates docs/tasks directory if it does not exist', async () => {
    await rm(join(tmpDir, 'docs', 'tasks'), { recursive: true, force: true });

    const { run } = await import('../commands/task.js');
    const output = await run(['Auto dir'], tmpDir);

    expect(output).toContain('T-001.md');
    const content = await readFile(join(tmpDir, 'docs', 'tasks', 'T-001.md'), 'utf-8');
    expect(content).toContain('# T-001: Auto dir');
  });
});

describe('task command - CLI integration', () => {
  it('task is registered as a valid command in cli dispatch', async () => {
    const { dispatch } = await import('../cli.js');
    const result = dispatch(['task', 'My title']);
    expect(result).toEqual({ action: 'task', args: ['My title'] });
  });

  it('task appears in help text', async () => {
    const { formatHelp } = await import('../cli.js');
    const help = formatHelp();
    expect(help).toContain('task');
  });
});
