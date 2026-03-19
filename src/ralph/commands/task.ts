import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { generateTaskScaffold } from '../templates/task-scaffold.js';

const TASK_FILE_RE = /^T-(\d+)\.md$/;

async function findHighestTaskNumber(tasksDir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(tasksDir);
  } catch {
    return 0;
  }

  let highest = 0;
  for (const entry of entries) {
    const match = entry.match(TASK_FILE_RE);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > highest) highest = num;
    }
  }
  return highest;
}

function padNumber(n: number): string {
  return String(n).padStart(3, '0');
}

interface ParsedFlags {
  title: string;
  depends?: string;
  complexity?: string;
  milestone?: string;
  prdRef?: string;
  touches?: string;
  roles?: string;
  dryRun: boolean;
}

function parseFlags(args: string[]): ParsedFlags {
  const result: ParsedFlags = { title: '', dryRun: false };
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--depends':
        result.depends = args[++i];
        break;
      case '--complexity':
        result.complexity = args[++i];
        break;
      case '--milestone':
        result.milestone = args[++i];
        break;
      case '--prd-ref':
        result.prdRef = args[++i];
        break;
      case '--touches':
        result.touches = args[++i];
        break;
      case '--roles':
        result.roles = args[++i];
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      default:
        positional.push(arg);
    }
  }

  result.title = positional.join(' ');
  return result;
}

function formatDepends(raw: string): string {
  return raw
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .join(', ');
}

function formatTouches(raw: string): string {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => `\`${t}\``)
    .join(', ');
}

function formatRoles(raw: string): string {
  return raw
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .join(', ');
}

async function loadCustomTemplate(
  projectRoot: string,
): Promise<{ template: string; warnings: string[] } | undefined> {
  const templatePath = join(projectRoot, 'docs', 'prompts', 'task-template.md');
  let content: string;
  try {
    content = await readFile(templatePath, 'utf-8');
  } catch {
    return undefined;
  }

  const warnings: string[] = [];
  if (!content.includes('{{task.number}}')) {
    warnings.push('Warning: Custom template is missing {{task.number}} placeholder');
  }
  if (!content.includes('{{task.title}}')) {
    warnings.push('Warning: Custom template is missing {{task.title}} placeholder');
  }

  return { template: content, warnings };
}

function interpolateCustomTemplate(template: string, number: number, title: string): string {
  const id = `T-${padNumber(number)}`;
  return template.replace(/\{\{task\.number\}\}/g, id).replace(/\{\{task\.title\}\}/g, title);
}

export async function run(args: string[], projectRoot?: string): Promise<string> {
  const root = projectRoot ?? process.cwd();
  const tasksDir = join(root, 'docs', 'tasks');
  const flags = parseFlags(args);

  if (!flags.title) {
    return 'Usage: ralph task "Title" [options]';
  }

  const highest = await findHighestTaskNumber(tasksDir);
  const nextNumber = highest + 1;
  const taskId = `T-${padNumber(nextNumber)}`;
  const filename = `${taskId}.md`;
  const outputLines: string[] = [];

  const customResult = await loadCustomTemplate(root);

  let content: string;
  if (customResult) {
    outputLines.push(...customResult.warnings);
    content = interpolateCustomTemplate(customResult.template, nextNumber, flags.title);
  } else {
    content = generateTaskScaffold({
      number: nextNumber,
      title: flags.title,
      depends: flags.depends ? formatDepends(flags.depends) : undefined,
      complexity: flags.complexity,
      milestone: flags.milestone,
      prdRef: flags.prdRef,
      touches: flags.touches ? formatTouches(flags.touches) : undefined,
      roles: flags.roles ? formatRoles(flags.roles) : undefined,
    });
  }

  if (flags.dryRun) {
    outputLines.push(content);
    return outputLines.join('\n');
  }

  await mkdir(tasksDir, { recursive: true });
  const filePath = join(tasksDir, filename);
  await writeFile(filePath, content, 'utf-8');

  outputLines.push(join('docs', 'tasks', filename));
  return outputLines.join('\n');
}
