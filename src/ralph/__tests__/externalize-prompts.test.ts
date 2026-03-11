import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runInit, type InitAnswers } from '../commands/init.js';
import { generatePromptsReadme } from '../templates/prompts-readme.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-ext-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

const defaultAnswers: InitAnswers = {
  projectName: 'test-app',
  language: 'TypeScript',
  packageManager: 'pnpm',
  testingFramework: 'Vitest',
  qualityCheck: 'pnpm check',
  testCommand: 'pnpm test',
  database: 'none',
};

describe('generatePromptsReadme', () => {
  it('returns a non-empty string', () => {
    const result = generatePromptsReadme();
    expect(result.length).toBeGreaterThan(0);
  });

  it('documents all template variables', () => {
    const result = generatePromptsReadme();
    const requiredVars = [
      '{{task.id}}',
      '{{task.title}}',
      '{{task.description}}',
      '{{task.prdReference}}',
      '{{task.prdContent}}',
      '{{task.touches}}',
      '{{task.hints}}',
      '{{config.language}}',
      '{{config.packageManager}}',
      '{{config.testingFramework}}',
      '{{config.qualityCheck}}',
      '{{config.testCommand}}',
      '{{config.fileNaming}}',
      '{{config.database}}',
      '{{project.rules}}',
      '{{codebaseIndex}}',
      '{{retryContext}}',
    ];
    for (const v of requiredVars) {
      expect(result).toContain(v);
    }
  });

  it('contains a heading', () => {
    const result = generatePromptsReadme();
    expect(result).toMatch(/^# /m);
  });
});

describe('runInit creates docs/prompts/README.md', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('creates docs/prompts/README.md', async () => {
    await runInit(tmpDir, defaultAnswers);
    const filePath = path.join(tmpDir, 'docs', 'prompts', 'README.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('includes README.md in created files list', async () => {
    const result = await runInit(tmpDir, defaultAnswers);
    expect(result.created).toContain('docs/prompts/README.md');
  });

  it('README.md contains template variable documentation', async () => {
    await runInit(tmpDir, defaultAnswers);
    const content = fs.readFileSync(path.join(tmpDir, 'docs', 'prompts', 'README.md'), 'utf-8');
    expect(content).toContain('{{task.id}}');
    expect(content).toContain('{{config.language}}');
  });
});

describe('runInit --prompts-only', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('only creates prompt files when promptsOnly is true', async () => {
    const result = await runInit(tmpDir, defaultAnswers, { promptsOnly: true });
    const promptFiles = [
      'docs/prompts/boot.md',
      'docs/prompts/system.md',
      'docs/prompts/rules.md',
      'docs/prompts/README.md',
    ];
    for (const f of promptFiles) {
      expect(result.created).toContain(f);
    }
    // Non-prompt files should NOT be created
    expect(result.created).not.toContain('docs/PRD.md');
    expect(result.created).not.toContain('docs/RALPH-METHODOLOGY.md');
    expect(result.created).not.toContain('docs/tasks/T-000.md');
    expect(result.created).not.toContain('.claude/CLAUDE.md');
    expect(result.created).not.toContain('ralph.config.json');
  });

  it('creates the prompt files on disk', async () => {
    await runInit(tmpDir, defaultAnswers, { promptsOnly: true });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prompts', 'boot.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prompts', 'system.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prompts', 'rules.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prompts', 'README.md'))).toBe(true);
  });

  it('does not create non-prompt files on disk', async () => {
    await runInit(tmpDir, defaultAnswers, { promptsOnly: true });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'PRD.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'ralph.config.json'))).toBe(false);
  });

  it('respects onConflict for existing prompt files', async () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prompts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'prompts', 'boot.md'), '# Custom boot');
    const onConflict = async () => false;
    const result = await runInit(tmpDir, defaultAnswers, { promptsOnly: true, onConflict });
    expect(result.skipped).toContain('docs/prompts/boot.md');
  });
});

describe('no hardcoded prompt text in source', () => {
  const srcDir = path.join(__dirname, '..');

  async function getSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === '__tests__' ||
          entry.name === 'templates' ||
          entry.name === 'node_modules'
        )
          continue;
        files.push(...(await getSourceFiles(fullPath)));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('non-template source files do not contain prompt methodology phrases', async () => {
    const files = await getSourceFiles(srcDir);
    const promptPhrases = [
      'PHASE LOGGING (MANDATORY)',
      'ANTI-PATTERNS (avoid these)',
      'TOOL USAGE (STRICT)',
      'BASH TIMEOUTS:',
      'COMMAND OUTPUT HYGIENE',
      'red/green TDD',
      'ONE commit per task',
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);
      for (const phrase of promptPhrases) {
        expect(
          content,
          `${relativePath} contains hardcoded prompt phrase: "${phrase}"`,
        ).not.toContain(phrase);
      }
    }
  });
});
