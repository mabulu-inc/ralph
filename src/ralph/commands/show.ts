import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultSystemPromptTemplate } from '../templates/system-prompt.js';
import { defaultBootPromptTemplate } from '../templates/boot-prompt.js';
import { generateMethodology } from '../templates/methodology.js';
import { BUILT_IN_ROLES, parseRolesFile } from '../core/roles.js';

const SUBCOMMANDS = ['system-prompt', 'boot-prompt', 'roles', 'methodology', 'rules'] as const;

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
}

export function parseShowArgs(args: string[]): {
  subcommand: Subcommand | 'help';
  json: boolean;
  builtInOnly: boolean;
} {
  const flags = { json: false, builtInOnly: false };
  let subcommand: Subcommand | 'help' = 'help';

  for (const arg of args) {
    if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--built-in-only') {
      flags.builtInOnly = true;
    } else if ((SUBCOMMANDS as readonly string[]).includes(arg)) {
      subcommand = arg as Subcommand;
    } else {
      subcommand = 'help';
      return { subcommand, ...flags };
    }
  }

  return { subcommand, ...flags };
}

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

function mergeContent(builtIn: string, extension: string | undefined): string {
  if (!extension) return builtIn;
  return `${builtIn}\n\n--- Project Extensions ---\n\n${extension}`;
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
      content: mergeContent(builtIn, extension),
      hasExtension: !!extension,
      builtIn,
      extension: extension ?? undefined,
    };
  }

  return {
    content: mergeContent(builtIn, extension),
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
      content: mergeContent(builtIn, extension),
      hasExtension: !!extension,
      builtIn,
      extension: extension ?? undefined,
    };
  }

  return {
    content: mergeContent(builtIn, extension),
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
      content: mergeContent(builtIn, extension),
      hasExtension: !!extension,
      builtIn,
      extension: extension ?? undefined,
    };
  }

  return {
    content: mergeContent(builtIn, extension),
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
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.content);
  }
}
