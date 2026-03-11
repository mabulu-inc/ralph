import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateCodebaseIndex } from '../core/codebase-index.js';

describe('generateCodebaseIndex', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ralph-index-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('extracts exported functions from TypeScript files', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(
      join(tmpDir, 'src', 'math.ts'),
      'export function add(a: number, b: number): number { return a + b; }\nexport function subtract(a: number, b: number): number { return a - b; }\n',
    );

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    expect(index).toContain('src/math.ts');
    expect(index).toContain('add');
    expect(index).toContain('subtract');
  });

  it('extracts exported classes', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(
      join(tmpDir, 'src', 'service.ts'),
      'export class UserService {\n  getUser() {}\n}\n',
    );

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    expect(index).toContain('UserService');
  });

  it('extracts exported interfaces and types', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(
      join(tmpDir, 'src', 'types.ts'),
      'export interface Config {\n  name: string;\n}\nexport type Status = "ok" | "error";\n',
    );

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    expect(index).toContain('Config');
    expect(index).toContain('Status');
  });

  it('extracts exported constants', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(
      join(tmpDir, 'src', 'constants.ts'),
      'export const MAX_RETRIES = 3;\nexport const DEFAULT_TIMEOUT = 5000;\n',
    );

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    expect(index).toContain('MAX_RETRIES');
    expect(index).toContain('DEFAULT_TIMEOUT');
  });

  it('formats one line per file with path and exports', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(
      join(tmpDir, 'src', 'utils.ts'),
      'export function helper() {}\nexport const VALUE = 1;\n',
    );

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    const lines = index.split('\n').filter((l) => l.includes('src/utils.ts'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('helper');
    expect(lines[0]).toContain('VALUE');
  });

  it('handles files with no exports', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(join(tmpDir, 'src', 'internal.ts'), 'function privateHelper() {}\n');

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    // File with no exports should still appear but with no export names
    expect(index).toContain('src/internal.ts');
  });

  it('scans nested directories', async () => {
    await mkdir(join(tmpDir, 'src', 'core'), { recursive: true });
    await writeFile(join(tmpDir, 'src', 'core', 'engine.ts'), 'export class Engine {}\n');

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    expect(index).toContain('src/core/engine.ts');
    expect(index).toContain('Engine');
  });

  it('excludes test files', async () => {
    await mkdir(join(tmpDir, 'src', '__tests__'), { recursive: true });
    await writeFile(
      join(tmpDir, 'src', '__tests__', 'foo.test.ts'),
      'export function testHelper() {}\n',
    );
    await writeFile(join(tmpDir, 'src', 'foo.ts'), 'export function foo() {}\n');

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    expect(index).not.toContain('__tests__');
    expect(index).not.toContain('.test.ts');
    expect(index).toContain('src/foo.ts');
  });

  it('falls back to file listing for non-TypeScript projects', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(join(tmpDir, 'src', 'main.py'), 'def hello():\n    pass\n');

    const index = await generateCodebaseIndex(tmpDir, 'Python');
    expect(index).toContain('src/main.py');
    // Should not attempt TS export extraction
    expect(index).not.toContain('hello');
  });

  it('truncates output at 200 lines', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    for (let i = 0; i < 250; i++) {
      await writeFile(join(tmpDir, 'src', `file${i}.ts`), `export const X${i} = ${i};\n`);
    }

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    const lines = index.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBeLessThanOrEqual(200);
  });

  it('prioritizes files listed in touches when truncating', async () => {
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    // Create 250 files but only some are in touches
    for (let i = 0; i < 250; i++) {
      await writeFile(join(tmpDir, 'src', `file${i}.ts`), `export const X${i} = ${i};\n`);
    }

    const touches = ['src/file200.ts', 'src/file249.ts'];
    const index = await generateCodebaseIndex(tmpDir, 'TypeScript', touches);
    // Touched files should appear in the index even with truncation
    expect(index).toContain('src/file200.ts');
    expect(index).toContain('src/file249.ts');
  });

  it('returns empty string when no source files exist', async () => {
    const index = await generateCodebaseIndex(tmpDir, 'TypeScript');
    expect(index).toBe('');
  });

  it('handles custom glob patterns via sourceGlobs', async () => {
    await mkdir(join(tmpDir, 'lib'), { recursive: true });
    await writeFile(join(tmpDir, 'lib', 'mod.ts'), 'export function libFn() {}\n');

    const index = await generateCodebaseIndex(tmpDir, 'TypeScript', [], ['lib/**/*.ts']);
    expect(index).toContain('lib/mod.ts');
    expect(index).toContain('libFn');
  });
});
