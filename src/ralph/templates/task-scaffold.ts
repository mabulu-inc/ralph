export interface TaskScaffoldOptions {
  number: number;
  title: string;
  depends?: string;
  complexity?: string;
  milestone?: string;
  prdRef?: string;
  touches?: string;
  roles?: string;
}

function padNumber(n: number): string {
  return String(n).padStart(3, '0');
}

export function generateTaskScaffold(opts: TaskScaffoldOptions): string {
  const id = `T-${padNumber(opts.number)}`;
  const depends = opts.depends ?? 'none';
  const milestone = opts.milestone ?? '';
  const prdRef = opts.prdRef ?? '';
  const complexity = opts.complexity ?? 'standard';
  const touches = opts.touches ?? '';
  const roles = opts.roles ?? '';

  const lines: string[] = [
    `# ${id}: ${opts.title}`,
    '',
    `- **Status**: TODO`,
    `- **Milestone**: ${milestone}`,
    `- **Depends**: ${depends}`,
    `- **PRD Reference**: ${prdRef}`,
    `- **Complexity**: ${complexity}`,
    `- **Touches**: ${touches}`,
    `- **Roles**: ${roles}`,
    '',
    `<!-- Sections: All sections below are sent to the agent except:`,
    `     Hints (sent separately), Produces, Completion Notes, and Blocked.`,
    `     Add any custom sections you need — they will reach the agent.`,
    `     Run \`ralph show task ${id}\` to verify. -->`,
    '',
    '## Description',
    '',
    'What to implement and why.',
    '',
    '## AC',
    '',
    '- Acceptance criteria here',
    '',
  ];

  return lines.join('\n');
}

export const TASK_TEMPLATE = `# {{task.number}}: {{task.title}}

- **Status**: TODO
- **Milestone**: {{task.milestone}}
- **Depends**: {{task.depends}}
- **PRD Reference**: {{task.prdRef}}
- **Complexity**: {{task.complexity}}
- **Touches**: {{task.touches}}
- **Roles**: {{task.roles}}

<!-- Sections: All sections below are sent to the agent except:
     Hints (sent separately), Produces, Completion Notes, and Blocked.
     Add any custom sections you need — they will reach the agent.
     Run \`ralph show task {{task.number}}\` to verify. -->

## Description

What to implement and why.

## AC

- Acceptance criteria here
`;
