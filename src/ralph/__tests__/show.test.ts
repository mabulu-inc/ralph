import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  showSystemPrompt,
  showBootPrompt,
  showRoles,
  showMethodology,
  showRules,
  parseShowArgs,
  formatShowHelp,
  run,
} from '../commands/show.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-show-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('parseShowArgs', () => {
  it('returns help when no subcommand given', () => {
    const result = parseShowArgs([]);
    expect(result.subcommand).toBe('help');
  });

  it('parses a valid subcommand', () => {
    const result = parseShowArgs(['system-prompt']);
    expect(result.subcommand).toBe('system-prompt');
    expect(result.json).toBe(false);
    expect(result.builtInOnly).toBe(false);
  });

  it('parses --json flag', () => {
    const result = parseShowArgs(['roles', '--json']);
    expect(result.subcommand).toBe('roles');
    expect(result.json).toBe(true);
  });

  it('parses --built-in-only flag', () => {
    const result = parseShowArgs(['boot-prompt', '--built-in-only']);
    expect(result.subcommand).toBe('boot-prompt');
    expect(result.builtInOnly).toBe(true);
  });

  it('parses both flags together', () => {
    const result = parseShowArgs(['methodology', '--json', '--built-in-only']);
    expect(result.subcommand).toBe('methodology');
    expect(result.json).toBe(true);
    expect(result.builtInOnly).toBe(true);
  });

  it('returns help for unknown subcommand', () => {
    const result = parseShowArgs(['unknown-thing']);
    expect(result.subcommand).toBe('help');
  });
});

describe('formatShowHelp', () => {
  it('lists available subcommands', () => {
    const help = formatShowHelp();
    expect(help).toContain('system-prompt');
    expect(help).toContain('boot-prompt');
    expect(help).toContain('roles');
    expect(help).toContain('methodology');
    expect(help).toContain('rules');
  });

  it('mentions options', () => {
    const help = formatShowHelp();
    expect(help).toContain('--json');
    expect(help).toContain('--built-in-only');
  });
});

describe('showSystemPrompt', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns built-in system prompt when no extension exists', async () => {
    const result = await showSystemPrompt(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Ralph Methodology');
    expect(result.hasExtension).toBe(false);
  });

  it('merges user extension when system.md exists', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'system.md'), 'Custom system extension');

    const result = await showSystemPrompt(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Custom system extension');
    expect(result.content).toContain('Project Extensions');
    expect(result.hasExtension).toBe(true);
  });

  it('ignores extension when builtInOnly is true', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'system.md'), 'Custom system extension');

    const result = await showSystemPrompt(tmpDir, { json: false, builtInOnly: true });
    expect(result.content).not.toContain('Custom system extension');
    expect(result.hasExtension).toBe(false);
  });

  it('returns JSON structure when json flag is true', async () => {
    const result = await showSystemPrompt(tmpDir, { json: true, builtInOnly: false });
    expect(result.builtIn).toBeDefined();
    expect(result.extension).toBeUndefined();
  });
});

describe('showBootPrompt', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns built-in boot prompt template with placeholders', async () => {
    const result = await showBootPrompt(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('{{task.id}}');
    expect(result.hasExtension).toBe(false);
  });

  it('merges user extension when boot.md exists', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'boot.md'), 'Custom boot extension');

    const result = await showBootPrompt(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Custom boot extension');
    expect(result.content).toContain('Project Extensions');
    expect(result.hasExtension).toBe(true);
  });

  it('ignores extension when builtInOnly is true', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'boot.md'), 'Custom boot extension');

    const result = await showBootPrompt(tmpDir, { json: false, builtInOnly: true });
    expect(result.content).not.toContain('Custom boot extension');
    expect(result.hasExtension).toBe(false);
  });
});

describe('showRoles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns all built-in roles annotated as built-in', async () => {
    const result = await showRoles(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Product Manager');
    expect(result.content).toContain('built-in');
    expect(result.hasExtension).toBe(false);
  });

  it('annotates overridden roles', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(promptsDir, 'roles.md'),
      '## Override: Product Manager\n\nCustom PM responsibility',
    );

    const result = await showRoles(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('overridden');
    expect(result.hasExtension).toBe(true);
  });

  it('annotates added roles', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(promptsDir, 'roles.md'),
      '## Add: Data Scientist\n\n- **Focus**: ML\n- **Responsibility**: Build models\n- **Participates**: Boot',
    );

    const result = await showRoles(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Data Scientist');
    expect(result.content).toContain('added');
    expect(result.hasExtension).toBe(true);
  });

  it('annotates disabled roles', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'roles.md'), '## Disable: UX/UI Designer\n');

    const result = await showRoles(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('UX/UI Designer');
    expect(result.content).toContain('disabled');
    expect(result.hasExtension).toBe(true);
  });

  it('ignores customizations when builtInOnly is true', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'roles.md'), '## Disable: UX/UI Designer\n');

    const result = await showRoles(tmpDir, { json: false, builtInOnly: true });
    expect(result.content).toContain('UX/UI Designer');
    expect(result.content).not.toContain('disabled');
  });

  it('returns structured JSON with role annotations', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'roles.md'), '## Disable: UX/UI Designer\n');

    const result = await showRoles(tmpDir, { json: true, builtInOnly: false });
    expect(result.roles).toBeDefined();
    const roles = result.roles!;
    const disabled = roles.find((r) => r.name === 'UX/UI Designer');
    expect(disabled?.source).toBe('disabled');
    const pm = roles.find((r) => r.name === 'Product Manager');
    expect(pm?.source).toBe('built-in');
  });
});

describe('showMethodology', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns built-in methodology when no extension exists', async () => {
    const result = await showMethodology(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Ralph Methodology');
    expect(result.hasExtension).toBe(false);
  });

  it('merges user extension when methodology.md exists', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'methodology.md'), 'Custom methodology notes');

    const result = await showMethodology(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Custom methodology notes');
    expect(result.content).toContain('Project Extensions');
    expect(result.hasExtension).toBe(true);
  });

  it('ignores extension when builtInOnly is true', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'methodology.md'), 'Custom methodology notes');

    const result = await showMethodology(tmpDir, { json: false, builtInOnly: true });
    expect(result.content).not.toContain('Custom methodology notes');
    expect(result.hasExtension).toBe(false);
  });
});

describe('showRules', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns empty message when no rules.md exists', async () => {
    const result = await showRules(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('No rules');
  });

  it('returns rules content when rules.md exists', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'rules.md'), '# Project Rules\n\n- Rule one');

    const result = await showRules(tmpDir, { json: false, builtInOnly: false });
    expect(result.content).toContain('Rule one');
  });

  it('returns JSON structure when json flag is true', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'rules.md'), '# Project Rules\n\n- Rule one');

    const result = await showRules(tmpDir, { json: true, builtInOnly: false });
    expect(result.rules).toBeDefined();
  });

  it('returns empty when builtInOnly since rules are user-defined', async () => {
    const promptsDir = path.join(tmpDir, 'docs', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'rules.md'), '# Project Rules\n\n- Rule one');

    const result = await showRules(tmpDir, { json: false, builtInOnly: true });
    expect(result.content).toContain('No built-in rules');
  });
});

describe('run', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    logSpy.mockRestore();
    cwdSpy.mockRestore();
    cleanup(tmpDir);
  });

  it('prints help when no subcommand given', async () => {
    await run([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('system-prompt'));
  });

  it('prints system-prompt content in text mode', async () => {
    await run(['system-prompt']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Ralph Methodology'));
  });

  it('prints JSON output when --json flag is used', async () => {
    await run(['system-prompt', '--json']);
    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.builtIn).toBeDefined();
  });

  it('handles each subcommand', async () => {
    const subcommands = ['system-prompt', 'boot-prompt', 'roles', 'methodology', 'rules'];
    for (const sub of subcommands) {
      logSpy.mockClear();
      await run([sub]);
      expect(logSpy).toHaveBeenCalled();
    }
  });

  it('handles --built-in-only with --json', async () => {
    await run(['roles', '--built-in-only', '--json']);
    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.roles).toBeDefined();
    expect(parsed.roles.every((r: { source: string }) => r.source === 'built-in')).toBe(true);
  });
});
