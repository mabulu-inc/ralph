import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

const MAX_INDEX_LINES = 200;

const TS_EXPORT_RE = /export\s+(?:async\s+)?(?:function|class|interface|type|const|enum)\s+(\w+)/g;

const DEFAULT_EXTENSIONS: Record<string, string[]> = {
  TypeScript: ['.ts', '.tsx'],
  JavaScript: ['.js', '.jsx'],
  Python: ['.py'],
  Go: ['.go'],
  Rust: ['.rs'],
};

const DEFAULT_ROOTS: Record<string, string[]> = {
  TypeScript: ['src'],
  JavaScript: ['src'],
  Python: ['src', '.'],
  Go: ['.'],
  Rust: ['src'],
};

const TEST_PATTERNS = ['__tests__', '.test.', '.spec.', '/test/', '/tests/'];

function isTestFile(relPath: string): boolean {
  return TEST_PATTERNS.some((p) => relPath.includes(p));
}

function isTypeScript(language: string): boolean {
  return language.toLowerCase() === 'typescript';
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TS_EXPORT_RE.exec(content)) !== null) {
    exports.push(match[1]);
  }
  return exports;
}

async function scanDir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
  } catch {
    return [];
  }
}

function matchesGlob(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const parts = pattern.split('/');
    const ext = parts[parts.length - 1]; // e.g. "*.ts"
    const prefix = parts.slice(0, -1).join('/'); // e.g. "lib" or "src/**"

    const fileExt = extname(relPath);
    const expectedExt = ext.replace('*', '');

    if (fileExt !== expectedExt) continue;

    if (prefix.includes('**')) {
      const rootPrefix = prefix.split('**')[0];
      if (!rootPrefix || relPath.startsWith(rootPrefix)) return true;
    } else if (prefix) {
      if (relPath.startsWith(prefix + '/')) return true;
    } else {
      return true;
    }
  }
  return false;
}

export async function generateCodebaseIndex(
  projectDir: string,
  language: string,
  touches: string[] = [],
  sourceGlobs?: string[],
): Promise<string> {
  const useExports = isTypeScript(language);

  let allFiles: string[];

  if (sourceGlobs) {
    const absFiles = await scanDir(projectDir);
    allFiles = absFiles
      .map((f) => relative(projectDir, f))
      .filter((rel) => !rel.startsWith('node_modules'))
      .filter((rel) => matchesGlob(rel, sourceGlobs))
      .filter((rel) => !isTestFile(rel));
  } else {
    const extensions = DEFAULT_EXTENSIONS[language] ?? [];
    const roots = DEFAULT_ROOTS[language] ?? ['src'];
    const fileSet = new Set<string>();

    for (const root of roots) {
      const scanRoot = root === '.' ? projectDir : join(projectDir, root);
      const absFiles = await scanDir(scanRoot);
      for (const absFile of absFiles) {
        const rel = relative(projectDir, absFile);
        if (rel.startsWith('node_modules')) continue;
        if (!extensions.includes(extname(rel))) continue;
        if (isTestFile(rel)) continue;
        fileSet.add(rel);
      }
    }

    allFiles = [...fileSet];
  }

  if (allFiles.length === 0) {
    return '';
  }

  allFiles.sort();

  const entries: Array<{ path: string; line: string; touched: boolean }> = [];

  for (const relPath of allFiles) {
    const absPath = join(projectDir, relPath);
    const touched = touches.includes(relPath);

    let line: string;
    if (useExports) {
      const content = await readFile(absPath, 'utf-8');
      const exports = extractExports(content);
      line = exports.length > 0 ? `${relPath}: ${exports.join(', ')}` : relPath;
    } else {
      line = relPath;
    }

    entries.push({ path: relPath, line, touched });
  }

  if (entries.length <= MAX_INDEX_LINES) {
    return entries.map((e) => e.line).join('\n');
  }

  const touchedEntries = entries.filter((e) => e.touched);
  const untouchedEntries = entries.filter((e) => !e.touched);
  const remaining = MAX_INDEX_LINES - touchedEntries.length;
  const selected = [...touchedEntries, ...untouchedEntries.slice(0, Math.max(0, remaining))];
  selected.sort((a, b) => a.path.localeCompare(b.path));

  return selected.map((e) => e.line).join('\n');
}
