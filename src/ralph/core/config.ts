import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProjectConfig {
  language: string;
  fileNaming: string | undefined;
  packageManager: string;
  testingFramework: string;
  qualityCheck: string;
  testCommand: string;
  database: string | undefined;
}

function extractConfigSection(content: string): string {
  const marker = '## Project-Specific Config';
  const start = content.indexOf(marker);
  if (start === -1) {
    throw new Error('Missing "## Project-Specific Config" section in CLAUDE.md');
  }
  const afterMarker = content.indexOf('\n', start);
  if (afterMarker === -1) return '';
  const rest = content.slice(afterMarker + 1);
  const nextSection = rest.search(/^## /m);
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

function extractConfigField(section: string, field: string): string | undefined {
  const re = new RegExp(`^- \\*\\*${field}\\*\\*:\\s*(.+)$`, 'm');
  const match = section.match(re);
  if (!match) return undefined;

  let value = match[1].trim();
  // Extract value from backticks if present: `some command` (optional trailing text)
  const backtickMatch = value.match(/^`([^`]+)`/);
  if (backtickMatch) {
    value = backtickMatch[1];
  }
  return value;
}

function requireField(section: string, field: string, label: string): string {
  const value = extractConfigField(section, field);
  if (!value) {
    throw new Error(`${label} is required in Project-Specific Config`);
  }
  return value;
}

export function parseConfig(content: string): ProjectConfig {
  const section = extractConfigSection(content);

  return {
    language: requireField(section, 'Language', 'Language'),
    fileNaming: extractConfigField(section, 'File naming'),
    packageManager: requireField(section, 'Package manager', 'Package manager'),
    testingFramework: requireField(section, 'Testing framework', 'Testing framework'),
    qualityCheck: requireField(section, 'Quality check', 'Quality check'),
    testCommand: requireField(section, 'Test command', 'Test command'),
    database: extractConfigField(section, 'Database'),
  };
}

export async function readConfig(projectDir: string): Promise<ProjectConfig> {
  const configPath = join(projectDir, '.claude', 'CLAUDE.md');
  let content: string;
  try {
    content = await readFile(configPath, 'utf-8');
  } catch {
    throw new Error(`Cannot read CLAUDE.md at ${configPath}`);
  }
  return parseConfig(content);
}
