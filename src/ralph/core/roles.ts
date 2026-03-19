export interface RoleDefinition {
  name: string;
  focus: string;
  responsibility: string;
  participates: string[];
}

export interface RoleOverride {
  name: string;
  description: string;
}

export interface RolesFileResult {
  overrides: RoleOverride[];
  additions: RoleDefinition[];
  disables: string[];
}

export const BUILT_IN_ROLES: readonly RoleDefinition[] = [
  {
    name: 'Product Manager',
    focus: 'Business-technical alignment',
    responsibility:
      'Bridges business goals to technical execution. Validates that the task aligns with PRD requirements and acceptance criteria. Ensures implementation scope matches what was asked for — no more, no less.',
    participates: ['Boot'],
  },
  {
    name: 'System Architect',
    focus: 'Structural design',
    responsibility:
      'Designs the structural blueprint. Reviews the approach for scalability, modularity, and separation of concerns.',
    participates: ['Boot'],
  },
  {
    name: 'Security Engineer',
    focus: 'Application security',
    responsibility:
      'Reviews designs for vulnerabilities before code is written. Validates OWASP guidelines compliance. No injection, XSS, or common attack vectors.',
    participates: ['Boot', 'Verify'],
  },
  {
    name: 'UX/UI Designer',
    focus: 'User experience',
    responsibility:
      'Ensures user-facing changes are intuitive and consistent. Reviews CLI output formatting, error messages, and user flows. Participates only when the task has user-facing surface.',
    participates: ['Boot'],
  },
  {
    name: 'Frontend & Backend Engineers',
    focus: 'Implementation',
    responsibility: 'Write the actual implementation. Focus on DRY, SRP, and clean modular code.',
    participates: ['Boot', 'Red', 'Green', 'Verify'],
  },
  {
    name: 'DevOps / SRE',
    focus: 'CI/CD and operations',
    responsibility:
      'Evaluates CI/CD and operational impact. Ensures changes do not break the build or introduce slow tests.',
    participates: ['Verify'],
  },
  {
    name: 'SDET',
    focus: 'Test strategy',
    responsibility:
      'Designs the test strategy and builds automated regression suites. Critically verifies that TDD actually drove the development.',
    participates: ['Verify'],
  },
  {
    name: 'Technical Lead',
    focus: 'Code quality',
    responsibility:
      'Performs rigorous code review. Evaluates naming, structure, error handling, and long-term maintainability.',
    participates: ['Verify'],
  },
  {
    name: 'DBA / Data Engineer',
    focus: 'Data and persistence',
    responsibility:
      'Reviews schema designs, query patterns, and data access layers. Participates only when the task involves data models or persistence.',
    participates: ['Boot', 'Verify'],
  },
];

const HEADING_RE = /^##\s+(Override|Add|Disable):\s+(.+)$/;
const FIELD_RE = /^-\s+\*\*(\w+)\*\*:\s*(.+)$/;

function extractSectionBody(lines: string[], startIndex: number): string {
  const bodyLines: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i])) break;
    bodyLines.push(lines[i]);
  }
  return bodyLines.join('\n').trim();
}

function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = line.match(FIELD_RE);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }
  return fields;
}

export function parseRolesFile(content: string): RolesFileResult {
  const overrides: RoleOverride[] = [];
  const additions: RoleDefinition[] = [];
  const disables: string[] = [];

  if (!content.trim()) {
    return { overrides, additions, disables };
  }

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(HEADING_RE);
    if (!match) continue;

    const directive = match[1];
    const roleName = match[2].trim();
    const body = extractSectionBody(lines, i + 1);

    switch (directive) {
      case 'Override': {
        overrides.push({ name: roleName, description: body });
        break;
      }
      case 'Add': {
        const fields = parseFields(body);
        additions.push({
          name: roleName,
          focus: fields['Focus'] ?? '',
          responsibility: fields['Responsibility'] ?? '',
          participates: fields['Participates']
            ? fields['Participates'].split(',').map((p) => p.trim())
            : [],
        });
        break;
      }
      case 'Disable': {
        disables.push(roleName);
        break;
      }
    }
  }

  return { overrides, additions, disables };
}

export function mergeRoles(
  builtIn: readonly RoleDefinition[],
  customizations: RolesFileResult,
): RoleDefinition[] {
  const disableSet = new Set(customizations.disables);
  const overrideMap = new Map(customizations.overrides.map((o) => [o.name, o.description]));

  const merged: RoleDefinition[] = builtIn
    .filter((role) => !disableSet.has(role.name))
    .map((role) => {
      const override = overrideMap.get(role.name);
      if (override !== undefined) {
        return { ...role, responsibility: override };
      }
      return { ...role };
    });

  for (const addition of customizations.additions) {
    merged.push({ ...addition });
  }

  return merged;
}

const ENGINEERS_NAME = 'Frontend & Backend Engineers';

export function filterRolesForTask(
  roles: readonly RoleDefinition[],
  taskRoles: string[] | undefined,
): RoleDefinition[] {
  if (!taskRoles || taskRoles.length === 0) {
    return [...roles];
  }

  const requested = new Set(taskRoles);
  requested.add(ENGINEERS_NAME);

  return roles.filter((role) => requested.has(role.name));
}

export function formatRolesForPrompt(roles: readonly RoleDefinition[]): string {
  const lines: string[] = [];

  lines.push('Role Definitions:');
  lines.push('');

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    lines.push(
      `${i + 1}. ${role.name} — ${role.responsibility} (Focus: ${role.focus}; Participates: ${role.participates.join(', ')})`,
    );
  }

  return lines.join('\n');
}
