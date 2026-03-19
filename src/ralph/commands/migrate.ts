import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { defaultBootPromptTemplate } from '../templates/boot-prompt.js';
import { defaultSystemPromptTemplate } from '../templates/system-prompt.js';
import { generatePromptsReadme } from '../templates/prompts-readme.js';
import { generateMethodology } from '../templates/methodology.js';
import { generateClaudeMd, type InitConfig } from '../templates/claude-md.js';
import { generateGeminiMd } from '../templates/gemini-md.js';
import { generateAgentsMd } from '../templates/agents-md.js';
import { generateContinueYaml } from '../templates/continue-yaml.js';
import { generateCursorRules } from '../templates/cursor-rules.js';

export type FileClassification = 'exact-match' | 'modified' | 'no-match';

export interface FileAnalysis {
  relativePath: string;
  classification: FileClassification;
  userContent: string | undefined;
}

export interface MigrateOptions {
  dryRun: boolean;
  force: boolean;
}

export interface MigrateSummary {
  removed: number;
  extracted: number;
  left: number;
}

export interface MigrateResult {
  analyses: FileAnalysis[];
  summary: MigrateSummary;
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function classifyFile(fileContent: string, knownTemplates: string[]): FileClassification {
  const normalizedFile = normalizeWhitespace(fileContent);

  for (const template of knownTemplates) {
    const normalizedTemplate = normalizeWhitespace(template);
    if (normalizedFile === normalizedTemplate) {
      return 'exact-match';
    }
  }

  // Check if file starts with (contains) a known template — indicating modifications
  for (const template of knownTemplates) {
    const normalizedTemplate = normalizeWhitespace(template);
    if (normalizedTemplate.length > 0 && normalizedFile.startsWith(normalizedTemplate)) {
      return 'modified';
    }
  }

  return 'no-match';
}

export function extractUserContent(fileContent: string, closestTemplate: string): string {
  if (!closestTemplate) {
    return fileContent.trim();
  }

  // Find where the template content ends and user content begins
  // Use line-by-line approach: find the longest prefix of template lines that match
  const templateLines = closestTemplate.trimEnd().split('\n');
  const fileLines = fileContent.split('\n');

  let matchEnd = 0;
  for (let i = 0; i < templateLines.length && i < fileLines.length; i++) {
    if (normalizeWhitespace(fileLines[i]) === normalizeWhitespace(templateLines[i])) {
      matchEnd = i + 1;
    } else {
      break;
    }
  }

  const remaining = fileLines.slice(matchEnd).join('\n').trim();
  return remaining || fileContent.trim();
}

function extractProjectNameFromContent(content: string): string | undefined {
  // Match patterns like "# ProjectName — Claude Code Instructions"
  // or "# ProjectName — Gemini CLI Instructions" etc.
  const match = content.match(/^#\s+(.+?)\s+—\s+/m);
  return match?.[1];
}

function generateAgentTemplates(projectName: string): InitConfig {
  return {
    projectName,
    language: 'TypeScript',
    packageManager: 'pnpm',
    testingFramework: 'Vitest',
    qualityCheck: 'pnpm check',
    testCommand: 'pnpm test',
  };
}

interface LegacyFileSpec {
  relativePath: string;
  getTemplates: (fileContent: string) => string[];
}

const PROMPT_FILES: LegacyFileSpec[] = [
  {
    relativePath: 'docs/prompts/boot.md',
    getTemplates: () => [defaultBootPromptTemplate(), ''],
  },
  {
    relativePath: 'docs/prompts/system.md',
    getTemplates: () => [defaultSystemPromptTemplate(), ''],
  },
  {
    relativePath: 'docs/prompts/README.md',
    getTemplates: () => [generatePromptsReadme(), ''],
  },
  {
    relativePath: 'docs/RALPH-METHODOLOGY.md',
    getTemplates: () => [generateMethodology(), ''],
  },
];

function agentFileSpec(
  relativePath: string,
  generator: (config: InitConfig) => string,
): LegacyFileSpec {
  return {
    relativePath,
    getTemplates: (fileContent: string) => {
      const projectName = extractProjectNameFromContent(fileContent);
      if (!projectName) return [''];
      const config = generateAgentTemplates(projectName);
      return [generator(config), ''];
    },
  };
}

const AGENT_FILES: LegacyFileSpec[] = [
  agentFileSpec('.claude/CLAUDE.md', generateClaudeMd),
  agentFileSpec('GEMINI.md', generateGeminiMd),
  agentFileSpec('AGENTS.md', generateAgentsMd),
  agentFileSpec('.continue/config.yaml', (config) => generateContinueYaml(config)),
  agentFileSpec('.cursor/rules/ralph.md', (config) => generateCursorRules(config)),
];

const ALL_LEGACY_FILES: LegacyFileSpec[] = [...PROMPT_FILES, ...AGENT_FILES];

async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

export async function analyzeProject(rootDir: string): Promise<FileAnalysis[]> {
  const analyses: FileAnalysis[] = [];

  for (const spec of ALL_LEGACY_FILES) {
    const fullPath = join(rootDir, spec.relativePath);
    const content = await readFileIfExists(fullPath);
    if (content === undefined) continue;

    const templates = spec.getTemplates(content);
    const classification = classifyFile(content, templates);

    let userContent: string | undefined;
    if (classification === 'modified') {
      // Find closest matching template for extraction
      const normalizedContent = normalizeWhitespace(content);
      let bestTemplate = templates[0];
      let bestLength = 0;
      for (const template of templates) {
        const nt = normalizeWhitespace(template);
        if (nt.length > bestLength && normalizedContent.startsWith(nt)) {
          bestTemplate = template;
          bestLength = nt.length;
        }
      }
      userContent = extractUserContent(content, bestTemplate);
    }

    analyses.push({ relativePath: spec.relativePath, classification, userContent });
  }

  return analyses;
}

export async function executePlan(
  rootDir: string,
  analyses: FileAnalysis[],
): Promise<MigrateSummary> {
  let removed = 0;
  let extracted = 0;
  let left = 0;

  for (const analysis of analyses) {
    const fullPath = join(rootDir, analysis.relativePath);
    switch (analysis.classification) {
      case 'exact-match':
        await unlink(fullPath);
        removed++;
        break;
      case 'modified':
        if (analysis.userContent) {
          await writeFile(fullPath, analysis.userContent, 'utf-8');
        }
        extracted++;
        break;
      case 'no-match':
        left++;
        break;
    }
  }

  return { removed, extracted, left };
}

export function formatPlan(analyses: FileAnalysis[]): string {
  if (analyses.length === 0) {
    return 'Nothing to migrate — no legacy files found.';
  }

  const lines: string[] = ['Migration plan:', ''];

  for (const a of analyses) {
    switch (a.classification) {
      case 'exact-match':
        lines.push(`  ✓ REMOVE  ${a.relativePath} (unmodified copy of built-in template)`);
        break;
      case 'modified':
        lines.push(`  → EXTRACT ${a.relativePath} (user customizations detected)`);
        break;
      case 'no-match':
        lines.push(`  ⚠ SKIP    ${a.relativePath} (unrecognized — verify with ralph show)`);
        break;
    }
  }

  return lines.join('\n');
}

export function formatSummary(summary: MigrateSummary): string {
  const parts: string[] = [];
  if (summary.removed > 0) {
    parts.push(`${summary.removed} file${summary.removed === 1 ? '' : 's'} removed`);
  }
  if (summary.extracted > 0) {
    parts.push(
      `${summary.extracted} file${summary.extracted === 1 ? '' : 's'} migrated to extensions`,
    );
  }
  if (summary.left > 0) {
    parts.push(`${summary.left} file${summary.left === 1 ? '' : 's'} left as-is`);
  }
  return parts.length > 0 ? `Summary: ${parts.join(', ')}.` : 'Nothing to migrate.';
}

export async function runMigrate(rootDir: string, options: MigrateOptions): Promise<MigrateResult> {
  const analyses = await analyzeProject(rootDir);

  if (analyses.length === 0) {
    return { analyses, summary: { removed: 0, extracted: 0, left: 0 } };
  }

  if (options.dryRun) {
    // Count what would happen without doing it
    const summary: MigrateSummary = { removed: 0, extracted: 0, left: 0 };
    for (const a of analyses) {
      switch (a.classification) {
        case 'exact-match':
          summary.removed++;
          break;
        case 'modified':
          summary.extracted++;
          break;
        case 'no-match':
          summary.left++;
          break;
      }
    }
    return { analyses, summary };
  }

  const summary = await executePlan(rootDir, analyses);
  return { analyses, summary };
}

function parseOptions(args: string[]): MigrateOptions {
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  };
}

export async function run(args: string[]): Promise<void> {
  const options = parseOptions(args);
  const rootDir = process.cwd();
  const analyses = await analyzeProject(rootDir);

  if (analyses.length === 0) {
    console.log('Nothing to migrate — no legacy files found.');
    return;
  }

  console.log(formatPlan(analyses));
  console.log('');

  if (options.dryRun) {
    console.log('Dry run — no files were modified.');
    return;
  }

  if (!options.force) {
    // In non-interactive mode, require --force
    console.log('Run with --force to apply changes, or --dry-run to preview.');
    return;
  }

  const summary = await executePlan(rootDir, analyses);
  console.log(formatSummary(summary));
}
