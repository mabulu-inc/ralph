import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('T-091: Documentation audit', () => {
  describe('README.md', () => {
    const content = read('README.md');

    it('does not list agent instructions file as a scaffolded item', () => {
      // The scaffolding list (bullet points under "This interactive command scaffolds")
      // should not include agent instructions file as something init creates.
      // A negative mention ("ralph does not generate...") is fine.
      const scaffoldSection = content.split(/This interactive command scaffolds/)[1];
      // The list items before the next paragraph break
      const listPortion = scaffoldSection?.split(/\n\n/)[0] ?? '';
      expect(listPortion).not.toMatch(/agent instructions file/i);
      expect(listPortion).not.toMatch(/\.claude\/CLAUDE\.md/);
    });
  });

  describe('quick-start.md', () => {
    const content = read('docs-site/src/content/docs/getting-started/quick-start.md');

    it('does not list docs/RALPH-METHODOLOGY.md', () => {
      expect(content).not.toMatch(/RALPH-METHODOLOGY/);
    });

    it('does not list docs/prompts/boot.md', () => {
      expect(content).not.toMatch(/prompts\/boot\.md/);
    });

    it('does not reference agent instructions file', () => {
      expect(content).not.toMatch(/agent instructions file/i);
      expect(content).not.toMatch(/\.claude\/CLAUDE\.md/);
    });

    it('lists ralph.config.json in scaffolding', () => {
      expect(content).toMatch(/ralph\.config\.json/);
    });

    it('scaffolding list matches exactly what init creates', () => {
      // The scaffolding list should contain exactly these 4 items
      expect(content).toMatch(/docs\/PRD\.md/);
      expect(content).toMatch(/docs\/tasks\/T-000\.md/);
      expect(content).toMatch(/docs\/prompts\/rules\.md/);
      expect(content).toMatch(/ralph\.config\.json/);
    });
  });

  describe('commands/init.md', () => {
    const content = read('docs-site/src/content/docs/commands/init.md');

    it('does not reference agent instructions file', () => {
      expect(content).not.toMatch(/agent instructions file/i);
      expect(content).not.toMatch(/\.claude\/CLAUDE\.md/);
    });

    it('does not list Database in prompts', () => {
      expect(content).not.toMatch(/Database/i);
    });
  });

  describe('commands/loop.md', () => {
    const content = read('docs-site/src/content/docs/commands/loop.md');

    it('does not have database step in iteration cycle', () => {
      expect(content).not.toMatch(/Database.*Docker/i);
      expect(content).not.toMatch(/start Docker containers/i);
    });

    it('does not have --no-db option', () => {
      expect(content).not.toMatch(/--no-db/);
    });

    it('lists all 5 exit conditions', () => {
      expect(content).toMatch(/All tasks are.*DONE/i);
      expect(content).toMatch(/Max iterations/i);
      expect(content).toMatch(/User interrupt/i);
      expect(content).toMatch(/budget exceeded/i);
      expect(content).toMatch(/No eligible tasks/i);
    });
  });

  describe('core-concepts/prompts.md', () => {
    const content = read('docs-site/src/content/docs/core-concepts/prompts.md');

    it('does not reference {{config.database}}', () => {
      expect(content).not.toMatch(/\{\{config\.database\}\}/);
    });
  });

  describe('astro.config.mjs sidebar', () => {
    const content = read('docs-site/astro.config.mjs');

    it('includes retry command in sidebar', () => {
      expect(content).toMatch(/retry/);
    });
  });

  describe('commands/review.md', () => {
    const content = read('docs-site/src/content/docs/commands/review.md');

    it('describes AI-powered coaching, not heuristic', () => {
      // Should mention AI-powered analysis
      expect(content).toMatch(/AI/i);
      // Should NOT describe coaching as heuristic checks
      expect(content).not.toMatch(/identifies tasks with missing acceptance criteria/i);
    });

    it('documents task-specific coaching (ralph review T-NNN --coach)', () => {
      expect(content).toMatch(/ralph review T-\w+ --coach/);
    });

    it('documents project-wide coaching mode', () => {
      expect(content).toMatch(/ralph review --coach/);
    });

    it('describes both coaching modes distinctly', () => {
      // Task-specific coaching section
      expect(content).toMatch(/task-specific/i);
      // Project-wide coaching section
      expect(content).toMatch(/project-wide/i);
    });
  });

  describe('T-092: extension-api.md template variable table', () => {
    const content = read('docs-site/src/content/docs/reference/extension-api.md');

    it('does not list {{config.database}} in the template variable table', () => {
      // Extract the Template Variable Reference table section
      const tableSection =
        content.split(/## Template Variable Reference/)[1]?.split(/^##/m)[0] ?? '';
      expect(tableSection).not.toMatch(/\{\{config\.database\}\}/);
    });
  });

  describe('T-092: commands/migrate.md', () => {
    const content = read('docs-site/src/content/docs/commands/migrate.md');

    it('does not reference ralph update by name', () => {
      expect(content).not.toMatch(/ralph update/);
    });
  });

  describe('T-092: getting-started/configuration.md', () => {
    const content = read('docs-site/src/content/docs/getting-started/configuration.md');

    it('does not claim init generates agent instructions files', () => {
      expect(content).not.toMatch(/ralph generates during.*init/i);
      expect(content).not.toMatch(/init.*generates/i);
    });

    it('explains that ralph does not manage agent instructions files', () => {
      expect(content).toMatch(/ralph does not manage agent instructions/i);
    });
  });

  describe('reference pages exist', () => {
    it('task-file-api.md exists', () => {
      expect(
        existsSync(resolve(root, 'docs-site/src/content/docs/reference/task-file-api.md')),
      ).toBe(true);
    });

    it('extension-api.md exists', () => {
      expect(
        existsSync(resolve(root, 'docs-site/src/content/docs/reference/extension-api.md')),
      ).toBe(true);
    });
  });

  describe('T-093: Agent pages do not claim ralph generates instructions files', () => {
    const agentPages = [
      'docs-site/src/content/docs/agents/claude.md',
      'docs-site/src/content/docs/agents/gemini.md',
      'docs-site/src/content/docs/agents/codex.md',
      'docs-site/src/content/docs/agents/continue.md',
      'docs-site/src/content/docs/agents/cursor.md',
    ];

    for (const page of agentPages) {
      const name = page.split('/').pop()!;
      const content = read(page);

      it(`${name}: does not claim ralph generates an instructions file`, () => {
        expect(content).not.toMatch(/ralph generates/i);
        expect(content).not.toMatch(/generates.*during.*init/i);
      });

      it(`${name}: states the loop prompt is self-contained`, () => {
        expect(content).toMatch(/self-contained/i);
      });
    }
  });

  describe('T-093: agents/overview.md', () => {
    const content = read('docs-site/src/content/docs/agents/overview.md');

    it('Supported Agents table has no "Instructions File" column', () => {
      expect(content).not.toMatch(/Instructions File/);
    });

    it('Provider Interface table uses supportsSystemPrompt instead of instructionsFile', () => {
      expect(content).toMatch(/supportsSystemPrompt/);
      expect(content).not.toMatch(/\binstructionsFile\b/);
    });
  });

  describe('T-093: configuration.md does not list database', () => {
    const content = read('docs-site/src/content/docs/getting-started/configuration.md');

    it('does not list database as a config field', () => {
      // Should not appear as a row in the optional fields table
      expect(content).not.toMatch(/\| `database`/);
    });
  });

  describe('T-093: core-concepts/tasks.md status values', () => {
    const content = read('docs-site/src/content/docs/core-concepts/tasks.md');

    it('does not list IN-PROGRESS as a status value', () => {
      expect(content).not.toMatch(/IN-PROGRESS/);
    });

    it('does not list SKIPPED as a status value', () => {
      expect(content).not.toMatch(/SKIPPED/);
    });

    it('lists TODO, DONE, and BLOCKED as valid statuses', () => {
      expect(content).toMatch(/`TODO`/);
      expect(content).toMatch(/`DONE`/);
      expect(content).toMatch(/`BLOCKED`/);
    });
  });

  describe('T-093: index.mdx landing page links', () => {
    const content = read('docs-site/src/content/docs/index.mdx');

    it('hero link uses /simplicity-ralph/ base path', () => {
      expect(content).toMatch(/\/simplicity-ralph\/getting-started\/introduction/);
      expect(content).not.toMatch(/\/ralph\/getting-started/);
    });

    it('GitHub link points to simplicity-ralph repo', () => {
      expect(content).toMatch(/https:\/\/github\.com\/mabulu-inc\/simplicity-ralph/);
      expect(content).not.toMatch(/github\.com\/mabulu-inc\/ralph[^/]/);
    });
  });

  describe('T-093: correct install packages', () => {
    it('gemini.md does not reference @anthropic-ai/gemini-cli', () => {
      const content = read('docs-site/src/content/docs/agents/gemini.md');
      expect(content).not.toMatch(/@anthropic-ai\/gemini-cli/);
    });

    it('continue.md does not reference @anthropic-ai/continue-cli', () => {
      const content = read('docs-site/src/content/docs/agents/continue.md');
      expect(content).not.toMatch(/@anthropic-ai\/continue-cli/);
    });
  });
});
