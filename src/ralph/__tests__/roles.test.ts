import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_ROLES,
  parseRolesFile,
  mergeRoles,
  filterRolesForTask,
  formatRolesForPrompt,
  type RoleDefinition,
} from '../core/roles.js';

describe('BUILT_IN_ROLES', () => {
  it('contains nine built-in roles', () => {
    expect(BUILT_IN_ROLES).toHaveLength(9);
  });

  it('includes all role names from §9.1', () => {
    const names = BUILT_IN_ROLES.map((r) => r.name);
    expect(names).toContain('Product Manager');
    expect(names).toContain('System Architect');
    expect(names).toContain('Security Engineer');
    expect(names).toContain('UX/UI Designer');
    expect(names).toContain('Frontend & Backend Engineers');
    expect(names).toContain('DevOps / SRE');
    expect(names).toContain('SDET');
    expect(names).toContain('Technical Lead');
    expect(names).toContain('DBA / Data Engineer');
  });

  it('each role has name, focus, responsibility, and participates', () => {
    for (const role of BUILT_IN_ROLES) {
      expect(role.name).toBeTruthy();
      expect(role.focus).toBeTruthy();
      expect(role.responsibility).toBeTruthy();
      expect(role.participates.length).toBeGreaterThan(0);
    }
  });
});

describe('parseRolesFile', () => {
  it('returns empty arrays when content is empty', () => {
    const result = parseRolesFile('');
    expect(result.overrides).toEqual([]);
    expect(result.additions).toEqual([]);
    expect(result.disables).toEqual([]);
  });

  it('parses an Override directive', () => {
    const content = `## Override: SDET

In this project, the SDET focuses on integration testing with real database connections.
All tests must hit the actual PostgreSQL instance, not mocks.
`;
    const result = parseRolesFile(content);
    expect(result.overrides).toHaveLength(1);
    expect(result.overrides[0].name).toBe('SDET');
    expect(result.overrides[0].description).toContain('integration testing');
  });

  it('parses an Add directive with Focus, Responsibility, and Participates', () => {
    const content = `## Add: Compliance Officer

- **Focus**: Regulatory compliance
- **Responsibility**: Reviews all data handling for GDPR/HIPAA compliance.
- **Participates**: Boot, Verify
`;
    const result = parseRolesFile(content);
    expect(result.additions).toHaveLength(1);
    const added = result.additions[0];
    expect(added.name).toBe('Compliance Officer');
    expect(added.focus).toBe('Regulatory compliance');
    expect(added.responsibility).toContain('GDPR/HIPAA');
    expect(added.participates).toEqual(['Boot', 'Verify']);
  });

  it('parses a Disable directive', () => {
    const content = `## Disable: UX/UI Designer

This is a headless API project with no user-facing surface.
`;
    const result = parseRolesFile(content);
    expect(result.disables).toHaveLength(1);
    expect(result.disables[0]).toBe('UX/UI Designer');
  });

  it('parses multiple directives in one file', () => {
    const content = `## Override: SDET

Custom SDET description.

## Add: Compliance Officer

- **Focus**: Compliance
- **Responsibility**: Checks compliance.
- **Participates**: Verify

## Disable: UX/UI Designer

Not needed.
`;
    const result = parseRolesFile(content);
    expect(result.overrides).toHaveLength(1);
    expect(result.additions).toHaveLength(1);
    expect(result.disables).toHaveLength(1);
  });
});

describe('mergeRoles', () => {
  it('returns built-in roles unchanged when no customizations', () => {
    const merged = mergeRoles(BUILT_IN_ROLES, {
      overrides: [],
      additions: [],
      disables: [],
    });
    expect(merged).toHaveLength(9);
    expect(merged.map((r) => r.name)).toEqual(BUILT_IN_ROLES.map((r) => r.name));
  });

  it('replaces a built-in role description with an override', () => {
    const merged = mergeRoles(BUILT_IN_ROLES, {
      overrides: [{ name: 'SDET', description: 'Custom SDET focus on integration tests.' }],
      additions: [],
      disables: [],
    });
    const sdet = merged.find((r) => r.name === 'SDET');
    expect(sdet).toBeDefined();
    expect(sdet!.responsibility).toBe('Custom SDET focus on integration tests.');
  });

  it('adds a new custom role', () => {
    const newRole: RoleDefinition = {
      name: 'Compliance Officer',
      focus: 'Regulatory compliance',
      responsibility: 'Checks GDPR compliance.',
      participates: ['Boot', 'Verify'],
    };
    const merged = mergeRoles(BUILT_IN_ROLES, {
      overrides: [],
      additions: [newRole],
      disables: [],
    });
    expect(merged).toHaveLength(10);
    const added = merged.find((r) => r.name === 'Compliance Officer');
    expect(added).toBeDefined();
    expect(added!.focus).toBe('Regulatory compliance');
  });

  it('removes a disabled role', () => {
    const merged = mergeRoles(BUILT_IN_ROLES, {
      overrides: [],
      additions: [],
      disables: ['UX/UI Designer'],
    });
    expect(merged).toHaveLength(8);
    expect(merged.find((r) => r.name === 'UX/UI Designer')).toBeUndefined();
  });

  it('applies all three operations together', () => {
    const merged = mergeRoles(BUILT_IN_ROLES, {
      overrides: [{ name: 'SDET', description: 'Custom SDET.' }],
      additions: [
        {
          name: 'Compliance Officer',
          focus: 'Compliance',
          responsibility: 'Checks compliance.',
          participates: ['Verify'],
        },
      ],
      disables: ['UX/UI Designer'],
    });
    // 9 - 1 disabled + 1 added = 9
    expect(merged).toHaveLength(9);
    expect(merged.find((r) => r.name === 'UX/UI Designer')).toBeUndefined();
    expect(merged.find((r) => r.name === 'Compliance Officer')).toBeDefined();
    expect(merged.find((r) => r.name === 'SDET')!.responsibility).toBe('Custom SDET.');
  });
});

describe('filterRolesForTask', () => {
  it('returns all roles when taskRoles is undefined', () => {
    const filtered = filterRolesForTask(BUILT_IN_ROLES, undefined);
    expect(filtered).toHaveLength(9);
  });

  it('returns all roles when taskRoles is empty array', () => {
    const filtered = filterRolesForTask(BUILT_IN_ROLES, []);
    expect(filtered).toHaveLength(9);
  });

  it('filters to listed roles plus Engineers when taskRoles is set', () => {
    const filtered = filterRolesForTask(BUILT_IN_ROLES, ['DBA / Data Engineer', 'SDET']);
    const names = filtered.map((r) => r.name);
    expect(names).toContain('DBA / Data Engineer');
    expect(names).toContain('SDET');
    expect(names).toContain('Frontend & Backend Engineers');
    expect(names).toHaveLength(3);
  });

  it('always includes Engineers even when not explicitly listed', () => {
    const filtered = filterRolesForTask(BUILT_IN_ROLES, ['Product Manager']);
    const names = filtered.map((r) => r.name);
    expect(names).toContain('Frontend & Backend Engineers');
    expect(names).toContain('Product Manager');
    expect(names).toHaveLength(2);
  });
});

describe('formatRolesForPrompt', () => {
  it('produces text containing each role name', () => {
    const text = formatRolesForPrompt(BUILT_IN_ROLES);
    for (const role of BUILT_IN_ROLES) {
      expect(text).toContain(role.name);
    }
  });

  it('includes participation phase information', () => {
    const text = formatRolesForPrompt(BUILT_IN_ROLES);
    expect(text).toContain('Boot');
    expect(text).toContain('Verify');
  });

  it('formats a single custom role correctly', () => {
    const roles: RoleDefinition[] = [
      {
        name: 'Test Role',
        focus: 'Testing focus',
        responsibility: 'Testing responsibility',
        participates: ['Boot'],
      },
    ];
    const text = formatRolesForPrompt(roles);
    expect(text).toContain('Test Role');
    expect(text).toContain('Testing focus');
    expect(text).toContain('Testing responsibility');
  });
});
