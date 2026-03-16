import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { generateClaudeMd, type InitConfig } from '../templates/claude-md.js';
import { generateAgentsMd } from '../templates/agents-md.js';
import { generateContinueYaml } from '../templates/continue-yaml.js';
import { generateCursorRules } from '../templates/cursor-rules.js';
import { generateGeminiMd } from '../templates/gemini-md.js';
import { generateMethodology } from '../templates/methodology.js';
import { defaultBootPromptTemplate } from '../templates/boot-prompt.js';
import { defaultSystemPromptTemplate } from '../templates/system-prompt.js';
import { generatePromptsReadme } from '../templates/prompts-readme.js';

export interface UpdateResult {
  updated: string[];
  upToDate: string[];
  error?: string;
}

interface RalphConfig {
  language: string;
  packageManager: string;
  testingFramework: string;
  qualityCheck: string;
  testCommand: string;
  agent: string;
  model?: string;
  fileNaming?: string;
  database?: string;
}

async function resolveProjectName(rootDir: string): Promise<string> {
  const pkgPath = path.join(rootDir, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (pkg.name && typeof pkg.name === 'string') {
      return pkg.name;
    }
  } catch {
    // No package.json
  }
  return path.basename(rootDir);
}

async function writeIfChanged(
  rootDir: string,
  relativePath: string,
  content: string,
  result: UpdateResult,
): Promise<void> {
  const fullPath = path.join(rootDir, relativePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });

  try {
    const existing = await fs.readFile(fullPath, 'utf-8');
    if (existing === content) {
      result.upToDate.push(relativePath);
      return;
    }
  } catch {
    // File doesn't exist — will be created
  }

  await fs.writeFile(fullPath, content);
  result.updated.push(relativePath);
}

function buildAgentConfig(
  agent: string,
  config: InitConfig,
): { relativePath: string; content: string } {
  switch (agent) {
    case 'gemini':
      return { relativePath: 'GEMINI.md', content: generateGeminiMd(config) };
    case 'codex':
      return { relativePath: 'AGENTS.md', content: generateAgentsMd(config) };
    case 'continue':
      return { relativePath: '.continue/config.yaml', content: generateContinueYaml(config) };
    case 'cursor':
      return { relativePath: '.cursor/rules/ralph.md', content: generateCursorRules(config) };
    default:
      return { relativePath: '.claude/CLAUDE.md', content: generateClaudeMd(config) };
  }
}

export async function runUpdate(rootDir: string): Promise<UpdateResult> {
  const result: UpdateResult = { updated: [], upToDate: [] };

  let rawConfig: string;
  try {
    rawConfig = await fs.readFile(path.join(rootDir, 'ralph.config.json'), 'utf-8');
  } catch {
    return {
      updated: [],
      upToDate: [],
      error: 'ralph.config.json not found. Run ralph init first.',
    };
  }

  const config = JSON.parse(rawConfig) as RalphConfig;
  const projectName = await resolveProjectName(rootDir);

  const initConfig: InitConfig = {
    projectName,
    language: config.language,
    packageManager: config.packageManager,
    testingFramework: config.testingFramework,
    qualityCheck: config.qualityCheck,
    testCommand: config.testCommand,
    fileNaming: config.fileNaming,
    database: config.database,
  };

  // Refresh methodology
  await writeIfChanged(rootDir, 'docs/RALPH-METHODOLOGY.md', generateMethodology(), result);

  // Refresh prompts (NOT rules.md — that's user-authored)
  await writeIfChanged(rootDir, 'docs/prompts/boot.md', defaultBootPromptTemplate(), result);
  await writeIfChanged(rootDir, 'docs/prompts/system.md', defaultSystemPromptTemplate(), result);
  await writeIfChanged(rootDir, 'docs/prompts/README.md', generatePromptsReadme(), result);

  // Regenerate agent config
  const agentConfig = buildAgentConfig(config.agent, initConfig);
  await writeIfChanged(rootDir, agentConfig.relativePath, agentConfig.content, result);

  return result;
}

export async function run(_args: string[]): Promise<void> {
  const cwd = process.cwd();
  const result = await runUpdate(cwd);

  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (result.updated.length > 0) {
    console.log('Updated:');
    for (const file of result.updated) {
      console.log(`  ${file}`);
    }
  }

  if (result.upToDate.length > 0) {
    console.log('Already up to date:');
    for (const file of result.upToDate) {
      console.log(`  ${file}`);
    }
  }

  if (result.updated.length === 0 && result.upToDate.length > 0) {
    console.log('\nAll files are already up to date.');
  } else if (result.updated.length > 0) {
    console.log('\nDone! Ralph files have been refreshed.');
  }
}
