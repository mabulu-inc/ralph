import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  normalizeWhitespace,
  classifyFile,
  extractUserContent,
  analyzeProject,
  executePlan,
  formatPlan,
  formatSummary,
  type FileAnalysis,
  runMigrate,
  run,
} from '../commands/migrate.js';
import {
  registerSnapshot,
  clearSnapshots,
  initializeCurrentSnapshots,
} from '../templates/snapshots/index.js';

import { defaultBootPromptTemplate } from '../templates/boot-prompt.js';
import { defaultSystemPromptTemplate } from '../templates/system-prompt.js';
import { generatePromptsReadme } from '../templates/prompts-readme.js';
import { generateMethodology } from '../templates/methodology.js';
import { generateClaudeMd } from '../templates/claude-md.js';
import { generateGeminiMd } from '../templates/gemini-md.js';
import { generateAgentsMd } from '../templates/agents-md.js';
import { generateContinueYaml } from '../templates/continue-yaml.js';
import { generateCursorRules } from '../templates/cursor-rules.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'ralph-migrate-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('normalizeWhitespace', () => {
  it('collapses all whitespace to single spaces and trims', () => {
    expect(normalizeWhitespace('  hello\n\n  world  ')).toBe('hello world');
  });

  it('handles empty strings', () => {
    expect(normalizeWhitespace('')).toBe('');
    expect(normalizeWhitespace('   ')).toBe('');
  });
});

describe('classifyFile', () => {
  it('returns exact-match when content matches a known template', () => {
    const template = '# Hello World\n\nSome content.';
    const fileContent = '# Hello World\n\nSome content.';
    expect(classifyFile(fileContent, [template])).toBe('exact-match');
  });

  it('returns exact-match when content matches after whitespace normalization', () => {
    const template = '# Hello World\n\nSome content.';
    const fileContent = '#  Hello World\n\n\nSome  content.';
    expect(classifyFile(fileContent, [template])).toBe('exact-match');
  });

  it('returns modified when content starts with a known template but has additions', () => {
    const template = '# Hello World\n\nSome content.';
    const fileContent = '# Hello World\n\nSome content.\n\n## My Custom Section\n\nExtra stuff.';
    expect(classifyFile(fileContent, [template])).toBe('modified');
  });

  it('returns no-match when content does not resemble any template', () => {
    const template = '# Hello World\n\nSome content.';
    const fileContent = '# Completely Different\n\nNothing similar.';
    expect(classifyFile(fileContent, [template])).toBe('no-match');
  });

  it('returns exact-match for empty file against empty template', () => {
    expect(classifyFile('', [''])).toBe('exact-match');
  });
});

describe('extractUserContent', () => {
  it('extracts content that was added beyond the template', () => {
    const template = '# Title\n\nBase content.';
    const fileContent = '# Title\n\nBase content.\n\n## My Custom Section\n\nUser addition.';
    const result = extractUserContent(fileContent, template);
    expect(result).toContain('My Custom Section');
    expect(result).toContain('User addition');
  });

  it('handles case where lines diverge mid-template', () => {
    const template = '# Title\n\nLine A\nLine B\nLine C';
    const fileContent = '# Title\n\nLine A\nDifferent line\nLine C\n\nUser stuff';
    const result = extractUserContent(fileContent, template);
    // Should break at the first non-matching line and return the rest
    expect(result).toContain('Different line');
    expect(result).toContain('User stuff');
  });

  it('returns full content if template is empty', () => {
    const result = extractUserContent('Some user content', '');
    expect(result).toContain('Some user content');
  });
});

describe('analyzeProject', () => {
  it('detects unmodified prompt files and marks them for removal', async () => {
    // Set up docs/prompts directory with exact copies
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());
    await writeFile(join(tmpDir, 'docs', 'prompts', 'system.md'), defaultSystemPromptTemplate());
    await writeFile(join(tmpDir, 'docs', 'prompts', 'README.md'), generatePromptsReadme());
    await writeFile(join(tmpDir, 'docs', 'RALPH-METHODOLOGY.md'), generateMethodology());

    const analyses = await analyzeProject(tmpDir);
    const promptAnalyses = analyses.filter(
      (a) =>
        a.relativePath.includes('boot.md') ||
        a.relativePath.includes('system.md') ||
        a.relativePath.includes('README.md') ||
        a.relativePath.includes('RALPH-METHODOLOGY.md'),
    );

    expect(promptAnalyses.length).toBe(4);
    for (const a of promptAnalyses) {
      expect(a.classification).toBe('exact-match');
    }
  });

  it('detects modified prompt files', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    const modified =
      defaultBootPromptTemplate() + '\n\n## My Custom Boot Extension\n\nDo extra stuff.';
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), modified);

    const analyses = await analyzeProject(tmpDir);
    const bootAnalysis = analyses.find((a) => a.relativePath === 'docs/prompts/boot.md');
    expect(bootAnalysis).toBeDefined();
    expect(bootAnalysis!.classification).toBe('modified');
    expect(bootAnalysis!.userContent).toContain('My Custom Boot Extension');
  });

  it('detects unmodified agent instructions files', async () => {
    const config = {
      projectName: 'test-project',
      language: 'TypeScript',
      packageManager: 'pnpm',
      testingFramework: 'Vitest',
      qualityCheck: 'pnpm check',
      testCommand: 'pnpm test',
    };

    await mkdir(join(tmpDir, '.claude'), { recursive: true });
    await writeFile(join(tmpDir, '.claude', 'CLAUDE.md'), generateClaudeMd(config));
    await writeFile(join(tmpDir, 'GEMINI.md'), generateGeminiMd(config));
    await writeFile(join(tmpDir, 'AGENTS.md'), generateAgentsMd(config));

    const analyses = await analyzeProject(tmpDir);
    const claudeAnalysis = analyses.find((a) => a.relativePath === '.claude/CLAUDE.md');
    const geminiAnalysis = analyses.find((a) => a.relativePath === 'GEMINI.md');
    const agentsAnalysis = analyses.find((a) => a.relativePath === 'AGENTS.md');

    expect(claudeAnalysis?.classification).toBe('exact-match');
    expect(geminiAnalysis?.classification).toBe('exact-match');
    expect(agentsAnalysis?.classification).toBe('exact-match');
  });

  it('detects modified agent instructions with user content', async () => {
    const config = {
      projectName: 'test-project',
      language: 'TypeScript',
      packageManager: 'pnpm',
      testingFramework: 'Vitest',
      qualityCheck: 'pnpm check',
      testCommand: 'pnpm test',
    };

    await mkdir(join(tmpDir, '.claude'), { recursive: true });
    const claudeContent =
      generateClaudeMd(config) + '\n## Project-Specific Config\n\n- **Language**: TypeScript\n';
    await writeFile(join(tmpDir, '.claude', 'CLAUDE.md'), claudeContent);

    const analyses = await analyzeProject(tmpDir);
    const claudeAnalysis = analyses.find((a) => a.relativePath === '.claude/CLAUDE.md');
    expect(claudeAnalysis?.classification).toBe('modified');
    expect(claudeAnalysis!.userContent).toContain('Project-Specific Config');
  });

  it('skips files that do not exist', async () => {
    // Empty directory — no legacy files
    const analyses = await analyzeProject(tmpDir);
    expect(analyses).toHaveLength(0);
  });

  it('handles files with only whitespace differences as exact match', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    const template = defaultBootPromptTemplate();
    // Add extra whitespace
    const withWhitespace = template.replace(/\n/g, '\n\n').replace(/ /g, '  ');
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), withWhitespace);

    const analyses = await analyzeProject(tmpDir);
    const bootAnalysis = analyses.find((a) => a.relativePath === 'docs/prompts/boot.md');
    expect(bootAnalysis?.classification).toBe('exact-match');
  });

  it('classifies unrecognizable files as no-match', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(
      join(tmpDir, 'docs', 'prompts', 'boot.md'),
      '# Completely custom boot prompt\n\nThis is my own prompt.',
    );

    const analyses = await analyzeProject(tmpDir);
    const bootAnalysis = analyses.find((a) => a.relativePath === 'docs/prompts/boot.md');
    expect(bootAnalysis?.classification).toBe('no-match');
  });

  it('detects continue yaml and cursor rules files', async () => {
    const config = {
      projectName: 'test-project',
      language: 'TypeScript',
      packageManager: 'pnpm',
      testingFramework: 'Vitest',
      qualityCheck: 'pnpm check',
      testCommand: 'pnpm test',
    };

    await mkdir(join(tmpDir, '.continue'), { recursive: true });
    await mkdir(join(tmpDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.continue', 'config.yaml'), generateContinueYaml(config));
    await writeFile(join(tmpDir, '.cursor', 'rules', 'ralph.md'), generateCursorRules(config));

    const analyses = await analyzeProject(tmpDir);
    const continueAnalysis = analyses.find((a) => a.relativePath === '.continue/config.yaml');
    const cursorAnalysis = analyses.find((a) => a.relativePath === '.cursor/rules/ralph.md');

    expect(continueAnalysis?.classification).toBe('exact-match');
    expect(cursorAnalysis?.classification).toBe('exact-match');
  });
});

describe('executePlan', () => {
  it('deletes exact-match files', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());

    const analyses: FileAnalysis[] = [
      {
        relativePath: 'docs/prompts/boot.md',
        classification: 'exact-match',
        userContent: undefined,
      },
    ];

    const result = await executePlan(tmpDir, analyses);
    expect(result.removed).toBe(1);

    // Verify file was deleted
    await expect(readFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), 'utf-8')).rejects.toThrow();
  });

  it('writes extracted content for modified files', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    const userContent = '## My Custom Extension\n\nCustom content here.';
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), 'original');

    const analyses: FileAnalysis[] = [
      {
        relativePath: 'docs/prompts/boot.md',
        classification: 'modified',
        userContent,
      },
    ];

    const result = await executePlan(tmpDir, analyses);
    expect(result.extracted).toBe(1);

    // Verify file contains only user content
    const content = await readFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), 'utf-8');
    expect(content).toBe(userContent);
  });

  it('leaves no-match files untouched', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    const original = '# My custom content';
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), original);

    const analyses: FileAnalysis[] = [
      {
        relativePath: 'docs/prompts/boot.md',
        classification: 'no-match',
        userContent: undefined,
      },
    ];

    const result = await executePlan(tmpDir, analyses);
    expect(result.left).toBe(1);

    // Verify file is untouched
    const content = await readFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), 'utf-8');
    expect(content).toBe(original);
  });
});

describe('runMigrate', () => {
  it('performs full migration removing unmodified files', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());
    await writeFile(join(tmpDir, 'docs', 'prompts', 'system.md'), defaultSystemPromptTemplate());

    const result = await runMigrate(tmpDir, { dryRun: false, force: true });
    expect(result.summary.removed).toBe(2);
    expect(result.summary.extracted).toBe(0);
    expect(result.summary.left).toBe(0);
  });

  it('dry-run does not modify files', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());

    const result = await runMigrate(tmpDir, { dryRun: true, force: false });
    expect(result.summary.removed).toBe(1);

    // File should still exist
    const content = await readFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), 'utf-8');
    expect(content).toBe(defaultBootPromptTemplate());
  });

  it('reports nothing to migrate when no legacy files exist', async () => {
    const result = await runMigrate(tmpDir, { dryRun: false, force: true });
    expect(result.analyses).toHaveLength(0);
    expect(result.summary.removed).toBe(0);
    expect(result.summary.extracted).toBe(0);
    expect(result.summary.left).toBe(0);
  });

  it('is idempotent — running again after migration reports nothing', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());

    await runMigrate(tmpDir, { dryRun: false, force: true });
    const second = await runMigrate(tmpDir, { dryRun: false, force: true });
    expect(second.analyses).toHaveLength(0);
  });

  it('handles empty files as exact match to empty string', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), '');

    const result = await runMigrate(tmpDir, { dryRun: false, force: true });
    // Empty file should be removed (treated as exact match to nothing useful)
    const bootResult = result.analyses.find((a) => a.relativePath === 'docs/prompts/boot.md');
    expect(bootResult?.classification).toBe('exact-match');
  });

  it('dry-run counts mixed outcomes correctly', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());
    const modifiedSystem =
      defaultSystemPromptTemplate() + '\n\n## Custom Addition\n\nSomething extra.';
    await writeFile(join(tmpDir, 'docs', 'prompts', 'system.md'), modifiedSystem);
    await writeFile(
      join(tmpDir, 'docs', 'RALPH-METHODOLOGY.md'),
      '# Totally custom\n\nNo resemblance.',
    );

    const result = await runMigrate(tmpDir, { dryRun: true, force: false });
    expect(result.summary.removed).toBe(1);
    expect(result.summary.extracted).toBe(1);
    expect(result.summary.left).toBe(1);

    // Files should all still exist
    await expect(
      readFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), 'utf-8'),
    ).resolves.toBeDefined();
    await expect(
      readFile(join(tmpDir, 'docs', 'prompts', 'system.md'), 'utf-8'),
    ).resolves.toBeDefined();
  });

  it('handles mixed outcomes across files', async () => {
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await mkdir(join(tmpDir, 'docs'), { recursive: true });

    // Exact match - should be removed
    await writeFile(join(tmpDir, 'docs', 'prompts', 'system.md'), defaultSystemPromptTemplate());

    // Modified - should extract user content
    const modifiedReadme =
      generatePromptsReadme() + "\n\n## My Custom Notes\n\nDon't forget to check tests.";
    await writeFile(join(tmpDir, 'docs', 'prompts', 'README.md'), modifiedReadme);

    // No match - should be left
    await writeFile(
      join(tmpDir, 'docs', 'RALPH-METHODOLOGY.md'),
      '# My custom methodology\n\nCompletely different.',
    );

    const result = await runMigrate(tmpDir, { dryRun: false, force: true });
    expect(result.summary.removed).toBe(1);
    expect(result.summary.extracted).toBe(1);
    expect(result.summary.left).toBe(1);
  });
});

describe('formatPlan', () => {
  it('returns nothing-to-migrate message for empty analyses', () => {
    const output = formatPlan([]);
    expect(output).toContain('Nothing to migrate');
  });

  it('formats each classification type', () => {
    const analyses: FileAnalysis[] = [
      {
        relativePath: 'docs/prompts/boot.md',
        classification: 'exact-match',
        userContent: undefined,
      },
      { relativePath: 'docs/prompts/system.md', classification: 'modified', userContent: 'custom' },
      {
        relativePath: 'docs/RALPH-METHODOLOGY.md',
        classification: 'no-match',
        userContent: undefined,
      },
    ];
    const output = formatPlan(analyses);
    expect(output).toContain('REMOVE');
    expect(output).toContain('boot.md');
    expect(output).toContain('MODIFIED');
    expect(output).toContain('system.md');
    expect(output).toContain('SKIP');
    expect(output).toContain('RALPH-METHODOLOGY.md');
  });
});

describe('formatSummary', () => {
  it('formats removed count', () => {
    expect(formatSummary({ removed: 2, extracted: 0, left: 0 })).toContain('2 files removed');
  });

  it('formats singular', () => {
    expect(formatSummary({ removed: 1, extracted: 0, left: 0 })).toContain('1 file removed');
  });

  it('formats extracted count', () => {
    expect(formatSummary({ removed: 0, extracted: 1, left: 0 })).toContain(
      '1 file migrated to extensions',
    );
  });

  it('formats left count', () => {
    expect(formatSummary({ removed: 0, extracted: 0, left: 3 })).toContain('3 files left as-is');
  });

  it('returns nothing-to-migrate for all zeros', () => {
    expect(formatSummary({ removed: 0, extracted: 0, left: 0 })).toContain('Nothing to migrate');
  });

  it('combines multiple parts', () => {
    const output = formatSummary({ removed: 1, extracted: 2, left: 1 });
    expect(output).toContain('1 file removed');
    expect(output).toContain('2 files migrated');
    expect(output).toContain('1 file left');
  });
});

describe('run (CLI entry point)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    cwdSpy?.mockRestore();
  });

  it('prints nothing-to-migrate when no legacy files', async () => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    await run([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No legacy files found'));
  });

  it('prints plan and dry-run message with --dry-run', async () => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());

    await run(['--dry-run']);
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Migration plan');
    expect(allOutput).toContain('Dry run');
  });

  it('prints plan and requires --force when no flags', async () => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());

    await run([]);
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('--force');
  });

  it('executes migration with --force', async () => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), defaultBootPromptTemplate());

    await run(['--force']);
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Summary');
    expect(allOutput).toContain('removed');
  });
});

describe('update deprecation', () => {
  it('update command mentions ralph migrate', async () => {
    const { runUpdate } = await import('../commands/update.js');
    const result = await runUpdate('/tmp/fake');
    expect(result.deprecated).toBe(true);
    expect(result.message).toContain('ralph migrate');
  });
});

describe('CLI registration', () => {
  it('dispatches migrate command', async () => {
    const { dispatch } = await import('../cli.js');
    const result = dispatch(['migrate']);
    expect(result).toEqual({ action: 'migrate', args: [] });
  });

  it('passes args to migrate', async () => {
    const { dispatch } = await import('../cli.js');
    const result = dispatch(['migrate', '--dry-run']);
    expect(result).toEqual({ action: 'migrate', args: ['--dry-run'] });
  });
});

describe('multi-version snapshot matching', () => {
  beforeEach(() => {
    clearSnapshots();
    initializeCurrentSnapshots();
  });

  afterEach(() => {
    clearSnapshots();
  });

  it('recognizes a file matching an older version snapshot', async () => {
    const olderTemplate = '# Old System Prompt\n\nThis was the v0.5.0 system prompt.';
    registerSnapshot({ type: 'system-prompt', version: '0.5.0', content: olderTemplate });

    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'system.md'), olderTemplate);

    const analyses = await analyzeProject(tmpDir);
    const sysAnalysis = analyses.find((a) => a.relativePath === 'docs/prompts/system.md');
    expect(sysAnalysis).toBeDefined();
    expect(sysAnalysis!.classification).toBe('exact-match');
    expect(sysAnalysis!.matchedVersion).toBe('0.5.0');
  });

  it('finds closest snapshot for modified older template via similarity', async () => {
    const olderTemplate = '# Boot Prompt\n\nLine A\nLine B\nLine C\nLine D\nLine E';
    registerSnapshot({ type: 'boot-prompt', version: '0.5.0', content: olderTemplate });

    const userFile =
      '# Boot Prompt\n\nLine A\nLine B\nLine C\nLine D\nLine E\n\n## My Addition\n\nExtra content';
    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(join(tmpDir, 'docs', 'prompts', 'boot.md'), userFile);

    const analyses = await analyzeProject(tmpDir);
    const bootAnalysis = analyses.find((a) => a.relativePath === 'docs/prompts/boot.md');
    expect(bootAnalysis).toBeDefined();
    expect(bootAnalysis!.classification).toBe('modified');
    expect(bootAnalysis!.matchedVersion).toBeDefined();
    expect(bootAnalysis!.userContent).toContain('My Addition');
    expect(bootAnalysis!.userLineCount).toBeGreaterThan(0);
  });

  it('classifies file as no-match when similarity is below threshold', async () => {
    registerSnapshot({
      type: 'system-prompt',
      version: '0.5.0',
      content: '# System Prompt\n\nTemplate content A\nTemplate content B',
    });

    await mkdir(join(tmpDir, 'docs', 'prompts'), { recursive: true });
    await writeFile(
      join(tmpDir, 'docs', 'prompts', 'system.md'),
      '# Completely Custom\n\nNothing to do with ralph templates at all.\nThis is entirely user content.',
    );

    const analyses = await analyzeProject(tmpDir);
    const sysAnalysis = analyses.find((a) => a.relativePath === 'docs/prompts/system.md');
    expect(sysAnalysis).toBeDefined();
    expect(sysAnalysis!.classification).toBe('no-match');
  });
});

describe('improved status messages', () => {
  it('formatPlan shows version info for exact matches', () => {
    const analyses: FileAnalysis[] = [
      {
        relativePath: 'docs/prompts/boot.md',
        classification: 'exact-match',
        userContent: undefined,
        matchedVersion: '0.6.0',
      },
    ];
    const output = formatPlan(analyses);
    expect(output).toContain('REMOVE');
    expect(output).toContain('v0.6.0');
    expect(output).not.toContain('unrecognized');
  });

  it('formatPlan shows version and line count for modified files', () => {
    const analyses: FileAnalysis[] = [
      {
        relativePath: 'docs/prompts/system.md',
        classification: 'modified',
        userContent: 'line 1\nline 2\nline 3',
        matchedVersion: '0.6.0',
        userLineCount: 3,
      },
    ];
    const output = formatPlan(analyses);
    expect(output).toContain('MODIFIED');
    expect(output).toContain('v0.6.0');
    expect(output).toContain('3 lines');
  });

  it('formatPlan shows "not a ralph file" for no-match files', () => {
    const analyses: FileAnalysis[] = [
      {
        relativePath: 'docs/RALPH-METHODOLOGY.md',
        classification: 'no-match',
        userContent: undefined,
      },
    ];
    const output = formatPlan(analyses);
    expect(output).toContain('SKIP');
    expect(output).toContain('not a ralph file');
    expect(output).not.toContain('unrecognized');
  });

  it('never contains the word "unrecognized" in any status', () => {
    const analyses: FileAnalysis[] = [
      {
        relativePath: 'a.md',
        classification: 'exact-match',
        userContent: undefined,
        matchedVersion: '0.6.0',
      },
      {
        relativePath: 'b.md',
        classification: 'modified',
        userContent: 'x',
        matchedVersion: '0.6.0',
        userLineCount: 1,
      },
      { relativePath: 'c.md', classification: 'no-match', userContent: undefined },
    ];
    const output = formatPlan(analyses);
    expect(output.toLowerCase()).not.toContain('unrecognized');
  });
});

describe('nothing to migrate message', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    cwdSpy?.mockRestore();
  });

  it('shows built-in-first architecture message when no legacy files', async () => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    await run([]);
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('built-in-first architecture');
    expect(allOutput).toContain('No migration needed');
  });
});
