import type { InitConfig } from './claude-md.js';

export function generateContinueYaml(config: InitConfig): string {
  const lines: string[] = [
    `# ${config.projectName} — Continue CLI Configuration`,
    '#',
    '# Project Config',
    `#   Language: ${config.language}`,
  ];

  if (config.fileNaming) {
    lines.push(`#   File naming: ${config.fileNaming}`);
  }

  lines.push(
    `#   Package manager: ${config.packageManager}`,
    `#   Testing framework: ${config.testingFramework}`,
    `#   Quality check: ${config.qualityCheck}`,
    `#   Test command: ${config.testCommand}`,
  );

  if (config.database) {
    lines.push(`#   Database: ${config.database}`);
  }

  lines.push(
    '',
    'name: ralph',
    `customInstructions: |`,
    `  Build ${config.projectName}.`,
    '  Requirements are defined in `docs/PRD.md`.',
    '  Follow the Ralph Methodology defined in `docs/RALPH-METHODOLOGY.md`.',
    '',
  );

  return lines.join('\n');
}
