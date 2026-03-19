import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultSystemPromptTemplate } from '../templates/system-prompt.js';
import { defaultBootPromptTemplate } from '../templates/boot-prompt.js';
import { generateMethodology } from '../templates/methodology.js';
import { BUILT_IN_ROLES, parseRolesFile, mergeRoles, filterRolesForTask } from '../core/roles.js';
import { parseTaskFile } from '../core/tasks.js';
import { EXCLUDED_SECTIONS } from '../core/markdown.js';

const SUBCOMMANDS = [
  'system-prompt',
  'boot-prompt',
  'roles',
  'methodology',
  'rules',
  'task',
] as const;

type Subcommand = (typeof SUBCOMMANDS)[number];

export interface ShowOptions {
  json: boolean;
  builtInOnly: boolean;
}

export interface RoleAnnotation {
  name: string;
  focus: string;
  responsibility: string;
  participates: string[];
  source: 'built-in' | 'overridden' | 'added' | 'disabled';
}

export interface ShowResult {
  content: string;
  hasExtension: boolean;
  builtIn?: string;
  extension?: string;
  roles?: RoleAnnotation[];
  rules?: string;
  taskBody?: string;
  hints?: string;
  excludedSections?: string[];
}

export function parseShowArgs(args: string[]): {
  subcommand: Subcommand | 'help';
  json: boolean;
  builtInOnly: boolean;
  taskId?: string;
} {
  const flags = { json: false, builtInOnly: false };
  let subcommand: Subcommand | 'help' = 'help';
  let taskId: string | undefined;

  for (const arg of args) {
    if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--built-in-only') {
      flags.builtInOnly = true;
    } else if (subcommand === 'task' && TASK_ID_RE.test(arg)) {
      taskId = arg;
    } else if ((SUBCOMMANDS as readonly string[]).includes(arg)) {
      subcommand = arg as Subcommand;
    } else {
      subcommand = 'help';
      return { subcommand, ...flags };
    }
  }

  if (subcommand === 'task' && !taskId) {
    return { subcommand: 'help', ...flags };
  }

  return { subcommand, taskId, ...flags };
}

const TASK_ID_RE = /^T-\d+$/;

export function formatShowHelp(): string {
  const lines: string[] = [];
  lines.push('Display effective prompt content (built-in + extensions)');
  lines.push('');
  lines.push('Usage: ralph show <subcommand> [options]');
  lines.push('');
  lines.push('Subcommands:');
  lines.push('  system-prompt  Effective system prompt');
  lines.push('  boot-prompt    Effective boot prompt template');
  lines.push('  roles          Active roles with source annotations');
  lines.push('  methodology    Ralph Methodology reference');
  lines.push('  rules          Project-specific rules');
  lines.push('  task T-NNN     Effective task body, hints, excluded sections, and roles');
  lines.push('');
  lines.push('Options:');
  lines.push('  --json           Output as JSON');
  lines.push('  --built-in-only  Show only built-in content, ignoring extensions');
  return lines.join('\n');
}

async function readExtension(filePath: string): Promise<string | undefined> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return content.trim() ? content : undefined;
  } catch {
    return undefined;
  }
}

function formatExtensionLines(extension: string): string {
  return extension
    .split('\n')
    .map((line) => (line.trim() ? `  ► ${line}` : ''))
    .join('\n');
}

function mergeContent(builtIn: string, extension: string | undefined, label?: string): string {
  if (!extension) return builtIn;
  const sectionName = label ?? 'Content';
  const formattedExtension = formatExtensionLines(extension);
  return `${sectionName} (built-in):\n${builtIn}\n\n${sectionName} (your extensions):\n${formattedExtension}`;
}

export async function showSystemPrompt(projectDir: string, opts: ShowOptions): Promise<ShowResult> {
  const builtIn = defaultSystemPromptTemplate();
  const extensionPath = join(projectDir, 'docs', 'prompts', 'system.md');

  if (opts.builtInOnly) {
    if (opts.json) {
      return { content: builtIn, hasExtension: false, builtIn };
    }
    return { content: builtIn, hasExtension: false };
  }

  const extension = await readExtension(extensionPath);

  if (opts.json) {
    return {
      content: mergeContent(builtIn, extension, 'System prompt'),
      hasExtension: !!extension,
      builtIn,
      extension: extension ?? undefined,
    };
  }

  return {
    content: mergeContent(builtIn, extension, 'System prompt'),
    hasExtension: !!extension,
  };
}

export async function showBootPrompt(projectDir: string, opts: ShowOptions): Promise<ShowResult> {
  const builtIn = defaultBootPromptTemplate();
  const extensionPath = join(projectDir, 'docs', 'prompts', 'boot.md');

  if (opts.builtInOnly) {
    if (opts.json) {
      return { content: builtIn, hasExtension: false, builtIn };
    }
    return { content: builtIn, hasExtension: false };
  }

  const extension = await readExtension(extensionPath);

  if (opts.json) {
    return {
      content: mergeContent(builtIn, extension, 'Boot prompt'),
      hasExtension: !!extension,
      builtIn,
      extension: extension ?? undefined,
    };
  }

  return {
    content: mergeContent(builtIn, extension, 'Boot prompt'),
    hasExtension: !!extension,
  };
}

export async function showRoles(projectDir: string, opts: ShowOptions): Promise<ShowResult> {
  const builtInRoles = [...BUILT_IN_ROLES];

  if (opts.builtInOnly) {
    const annotations: RoleAnnotation[] = builtInRoles.map((r) => ({
      ...r,
      source: 'built-in' as const,
    }));

    if (opts.json) {
      return {
        content: formatRolesText(annotations),
        hasExtension: false,
        roles: annotations,
      };
    }

    return {
      content: formatRolesText(annotations),
      hasExtension: false,
    };
  }

  const rolesPath = join(projectDir, 'docs', 'prompts', 'roles.md');
  let rolesContent = '';
  try {
    rolesContent = await readFile(rolesPath, 'utf-8');
  } catch {
    // no roles file
  }

  const customizations = parseRolesFile(rolesContent);
  const hasExtension =
    customizations.overrides.length > 0 ||
    customizations.additions.length > 0 ||
    customizations.disables.length > 0;

  const overrideNames = new Set(customizations.overrides.map((o) => o.name));
  const disableNames = new Set(customizations.disables);

  const annotations: RoleAnnotation[] = [];

  for (const role of builtInRoles) {
    if (disableNames.has(role.name)) {
      annotations.push({ ...role, source: 'disabled' });
    } else if (overrideNames.has(role.name)) {
      const override = customizations.overrides.find((o) => o.name === role.name)!;
      annotations.push({
        ...role,
        responsibility: override.description,
        source: 'overridden',
      });
    } else {
      annotations.push({ ...role, source: 'built-in' });
    }
  }

  for (const addition of customizations.additions) {
    annotations.push({ ...addition, source: 'added' });
  }

  if (opts.json) {
    return {
      content: formatRolesText(annotations),
      hasExtension,
      roles: annotations,
    };
  }

  return {
    content: formatRolesText(annotations),
    hasExtension,
  };
}

function formatRolesText(roles: RoleAnnotation[]): string {
  const lines: string[] = [];
  lines.push('Roles:');
  lines.push('');

  for (const role of roles) {
    const sourceLabel = `[${role.source}]`;
    lines.push(`  ${role.name} ${sourceLabel}`);
    lines.push(`    Focus: ${role.focus}`);
    lines.push(`    Responsibility: ${role.responsibility}`);
    lines.push(`    Participates: ${role.participates.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

export async function showMethodology(projectDir: string, opts: ShowOptions): Promise<ShowResult> {
  const builtIn = generateMethodology();
  const extensionPath = join(projectDir, 'docs', 'prompts', 'methodology.md');

  if (opts.builtInOnly) {
    if (opts.json) {
      return { content: builtIn, hasExtension: false, builtIn };
    }
    return { content: builtIn, hasExtension: false };
  }

  const extension = await readExtension(extensionPath);

  if (opts.json) {
    return {
      content: mergeContent(builtIn, extension, 'Methodology'),
      hasExtension: !!extension,
      builtIn,
      extension: extension ?? undefined,
    };
  }

  return {
    content: mergeContent(builtIn, extension, 'Methodology'),
    hasExtension: !!extension,
  };
}

export async function showRules(projectDir: string, opts: ShowOptions): Promise<ShowResult> {
  if (opts.builtInOnly) {
    if (opts.json) {
      return {
        content: 'No built-in rules — rules are project-specific.',
        hasExtension: false,
        rules: '',
      };
    }
    return { content: 'No built-in rules — rules are project-specific.', hasExtension: false };
  }

  const rulesPath = join(projectDir, 'docs', 'prompts', 'rules.md');
  let rulesContent: string | undefined;
  try {
    rulesContent = await readFile(rulesPath, 'utf-8');
  } catch {
    // no rules file
  }

  if (!rulesContent?.trim()) {
    if (opts.json) {
      return {
        content: 'No rules defined. Create docs/prompts/rules.md to add project rules.',
        hasExtension: false,
        rules: '',
      };
    }
    return {
      content: 'No rules defined. Create docs/prompts/rules.md to add project rules.',
      hasExtension: false,
    };
  }

  if (opts.json) {
    return { content: rulesContent, hasExtension: false, rules: rulesContent };
  }

  return { content: rulesContent, hasExtension: false };
}

export async function showTask(
  projectDir: string,
  taskId: string,
  opts: ShowOptions,
): Promise<ShowResult> {
  const taskPath = join(projectDir, 'tasks', `${taskId}.md`);
  const content = await readFile(taskPath, 'utf-8');
  const task = parseTaskFile(`${taskId}.md`, content);

  const rolesPath = join(projectDir, 'docs', 'prompts', 'roles.md');
  let rolesContent = '';
  try {
    rolesContent = await readFile(rolesPath, 'utf-8');
  } catch {
    // no roles file
  }

  const customizations = parseRolesFile(rolesContent);
  const merged = mergeRoles(BUILT_IN_ROLES, customizations);
  const filtered = filterRolesForTask(merged, task.roles);

  const annotations: RoleAnnotation[] = filtered.map((role) => {
    const overrideNames = new Set(customizations.overrides.map((o) => o.name));
    const additionNames = new Set(customizations.additions.map((a) => a.name));
    let source: RoleAnnotation['source'] = 'built-in';
    if (overrideNames.has(role.name)) source = 'overridden';
    else if (additionNames.has(role.name)) source = 'added';
    return { ...role, source };
  });

  const excludedSections = [...EXCLUDED_SECTIONS];

  if (opts.json) {
    return {
      content: formatTaskText(task.description, task.hints, excludedSections, annotations),
      hasExtension: false,
      taskBody: task.description,
      hints: task.hints,
      excludedSections,
      roles: annotations,
    };
  }

  return {
    content: formatTaskText(task.description, task.hints, excludedSections, annotations),
    hasExtension: false,
    taskBody: task.description,
    hints: task.hints,
    excludedSections,
    roles: annotations,
  };
}

function formatTaskText(
  body: string,
  hints: string,
  excludedSections: string[],
  roles: RoleAnnotation[],
): string {
  const lines: string[] = [];

  lines.push('=== Task Body ({{task.description}}) ===');
  lines.push('');
  lines.push(body || '(empty)');
  lines.push('');

  lines.push('=== Hints ({{task.hints}}) ===');
  lines.push('');
  lines.push(hints || '(none)');
  lines.push('');

  lines.push('=== Excluded Sections ===');
  lines.push('');
  for (const section of excludedSections) {
    lines.push(`  - ${section}`);
  }
  lines.push('');

  lines.push('=== Active Roles ===');
  lines.push('');
  for (const role of roles) {
    lines.push(`  ${role.name} [${role.source}]`);
  }

  return lines.join('\n');
}

export async function run(args: string[]): Promise<void> {
  const parsed = parseShowArgs(args);

  if (parsed.subcommand === 'help') {
    console.log(formatShowHelp());
    return;
  }

  const projectDir = process.cwd();
  const opts: ShowOptions = { json: parsed.json, builtInOnly: parsed.builtInOnly };

  let result: ShowResult;

  switch (parsed.subcommand) {
    case 'system-prompt':
      result = await showSystemPrompt(projectDir, opts);
      break;
    case 'boot-prompt':
      result = await showBootPrompt(projectDir, opts);
      break;
    case 'roles':
      result = await showRoles(projectDir, opts);
      break;
    case 'methodology':
      result = await showMethodology(projectDir, opts);
      break;
    case 'rules':
      result = await showRules(projectDir, opts);
      break;
    case 'task':
      result = await showTask(projectDir, parsed.taskId!, opts);
      break;
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.content);
  }
}
