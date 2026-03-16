import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { runUpdate } from '../commands/update.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-update-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeConfig(dir: string, overrides: Record<string, unknown> = {}): void {
  const config = {
    language: 'TypeScript',
    packageManager: 'pnpm',
    testingFramework: 'Vitest',
    qualityCheck: 'pnpm check',
    testCommand: 'pnpm test',
    agent: 'claude',
    ...overrides,
  };
  fs.writeFileSync(path.join(dir, 'ralph.config.json'), JSON.stringify(config, null, 2));
}

describe('runUpdate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('fails when ralph.config.json is missing', async () => {
    const result = await runUpdate(tmpDir);
    expect(result.error).toMatch(/ralph\.config\.json/);
  });

  it('overwrites docs/RALPH-METHODOLOGY.md', async () => {
    writeConfig(tmpDir);
    const methodologyPath = path.join(tmpDir, 'docs', 'RALPH-METHODOLOGY.md');
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(methodologyPath, '# Old methodology\n');

    const result = await runUpdate(tmpDir);
    expect(result.error).toBeUndefined();
    expect(result.updated).toContain('docs/RALPH-METHODOLOGY.md');
    const content = fs.readFileSync(methodologyPath, 'utf-8');
    expect(content).toContain('# Ralph Methodology');
  });

  it('overwrites docs/prompts/boot.md', async () => {
    writeConfig(tmpDir);
    const bootPath = path.join(tmpDir, 'docs', 'prompts', 'boot.md');
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prompts'), { recursive: true });
    fs.writeFileSync(bootPath, '# Old boot prompt\n');

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('docs/prompts/boot.md');
    const content = fs.readFileSync(bootPath, 'utf-8');
    expect(content).toContain('{{task.id}}');
  });

  it('overwrites docs/prompts/system.md', async () => {
    writeConfig(tmpDir);
    const systemPath = path.join(tmpDir, 'docs', 'prompts', 'system.md');
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prompts'), { recursive: true });
    fs.writeFileSync(systemPath, '# Old system prompt\n');

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('docs/prompts/system.md');
    const content = fs.readFileSync(systemPath, 'utf-8');
    expect(content).toContain('[PHASE]');
  });

  it('overwrites docs/prompts/README.md', async () => {
    writeConfig(tmpDir);
    const readmePath = path.join(tmpDir, 'docs', 'prompts', 'README.md');
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prompts'), { recursive: true });
    fs.writeFileSync(readmePath, '# Old readme\n');

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('docs/prompts/README.md');
  });

  it('regenerates .claude/CLAUDE.md for claude agent', async () => {
    writeConfig(tmpDir, { agent: 'claude' });
    const claudePath = path.join(tmpDir, '.claude', 'CLAUDE.md');
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(claudePath, '# Old claude config\n');

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('.claude/CLAUDE.md');
    const content = fs.readFileSync(claudePath, 'utf-8');
    expect(content).toContain('Ralph Methodology');
  });

  it('regenerates GEMINI.md for gemini agent', async () => {
    writeConfig(tmpDir, { agent: 'gemini' });

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('GEMINI.md');
    const content = fs.readFileSync(path.join(tmpDir, 'GEMINI.md'), 'utf-8');
    expect(content).toContain('Ralph Methodology');
  });

  it('regenerates AGENTS.md for codex agent', async () => {
    writeConfig(tmpDir, { agent: 'codex' });

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('AGENTS.md');
  });

  it('regenerates .continue/config.yaml for continue agent', async () => {
    writeConfig(tmpDir, { agent: 'continue' });

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('.continue/config.yaml');
  });

  it('regenerates .cursor/rules/ralph.md for cursor agent', async () => {
    writeConfig(tmpDir, { agent: 'cursor' });

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('.cursor/rules/ralph.md');
  });

  it('reports unchanged files as up-to-date', async () => {
    writeConfig(tmpDir);
    // Run update once to create all files with latest content
    await runUpdate(tmpDir);
    // Run again — everything should be up-to-date
    const result = await runUpdate(tmpDir);
    expect(result.upToDate.length).toBeGreaterThan(0);
    expect(result.updated.length).toBe(0);
  });

  it('does NOT touch docs/PRD.md', async () => {
    writeConfig(tmpDir);
    const prdPath = path.join(tmpDir, 'docs', 'PRD.md');
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(prdPath, '# My PRD\n');

    await runUpdate(tmpDir);
    const content = fs.readFileSync(prdPath, 'utf-8');
    expect(content).toBe('# My PRD\n');
  });

  it('does NOT touch docs/tasks/', async () => {
    writeConfig(tmpDir);
    const taskPath = path.join(tmpDir, 'docs', 'tasks', 'T-001.md');
    fs.mkdirSync(path.join(tmpDir, 'docs', 'tasks'), { recursive: true });
    fs.writeFileSync(taskPath, '# T-001: My task\n');

    await runUpdate(tmpDir);
    const content = fs.readFileSync(taskPath, 'utf-8');
    expect(content).toBe('# T-001: My task\n');
  });

  it('does NOT touch ralph.config.json', async () => {
    const configContent = JSON.stringify(
      {
        language: 'TypeScript',
        packageManager: 'pnpm',
        testingFramework: 'Vitest',
        qualityCheck: 'pnpm check',
        testCommand: 'pnpm test',
        agent: 'claude',
      },
      null,
      2,
    );
    fs.writeFileSync(path.join(tmpDir, 'ralph.config.json'), configContent);

    await runUpdate(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'ralph.config.json'), 'utf-8');
    expect(content).toBe(configContent);
  });

  it('does NOT touch docs/prompts/rules.md', async () => {
    writeConfig(tmpDir);
    const rulesPath = path.join(tmpDir, 'docs', 'prompts', 'rules.md');
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prompts'), { recursive: true });
    fs.writeFileSync(rulesPath, '# My custom rules\n');

    await runUpdate(tmpDir);
    const content = fs.readFileSync(rulesPath, 'utf-8');
    expect(content).toBe('# My custom rules\n');
  });

  it('creates directories when they do not exist', async () => {
    writeConfig(tmpDir);

    const result = await runUpdate(tmpDir);
    expect(result.error).toBeUndefined();
    expect(fs.existsSync(path.join(tmpDir, 'docs'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prompts'))).toBe(true);
  });

  it('uses projectName from package.json in agent config', async () => {
    writeConfig(tmpDir, { agent: 'claude' });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'my-project' }));

    const result = await runUpdate(tmpDir);
    expect(result.updated).toContain('.claude/CLAUDE.md');
    const content = fs.readFileSync(path.join(tmpDir, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('my-project');
  });

  it('falls back to directory name when no package.json', async () => {
    writeConfig(tmpDir, { agent: 'claude' });

    const result = await runUpdate(tmpDir);
    expect(result.error).toBeUndefined();
    // Agent config should be created with the directory basename
    expect(result.updated).toContain('.claude/CLAUDE.md');
  });
});
