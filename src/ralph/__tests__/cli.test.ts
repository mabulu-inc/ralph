import { describe, it, expect } from 'vitest';
import { dispatch, formatHelp } from '../cli.js';

const KNOWN_COMMANDS = [
  'init',
  'loop',
  'monitor',
  'kill',
  'milestones',
  'shas',
  'cost',
  'update',
] as const;

describe('CLI dispatch', () => {
  it('returns help action when no command is given', () => {
    const result = dispatch([]);
    expect(result).toEqual({ action: 'help' });
  });

  it('returns help action for unknown commands', () => {
    const result = dispatch(['bogus']);
    expect(result).toEqual({ action: 'help', unknown: 'bogus' });
  });

  it.each(KNOWN_COMMANDS)('dispatches known command: %s', (cmd) => {
    const result = dispatch([cmd]);
    expect(result).toEqual({ action: cmd, args: [] });
  });

  it('passes remaining args to the command', () => {
    const result = dispatch(['loop', '-n', '5', '--verbose']);
    expect(result).toEqual({ action: 'loop', args: ['-n', '5', '--verbose'] });
  });

  it('returns help action for --help flag', () => {
    const result = dispatch(['--help']);
    expect(result).toEqual({ action: 'help' });
  });

  it('returns help action for -h flag', () => {
    const result = dispatch(['-h']);
    expect(result).toEqual({ action: 'help' });
  });
});

describe('CLI help text', () => {
  it('formatHelp returns usage text listing all commands', () => {
    const help = formatHelp();
    expect(help).toContain('ralph');
    expect(help).toContain('Usage:');
    for (const cmd of KNOWN_COMMANDS) {
      expect(help).toContain(cmd);
    }
  });

  it('formatHelp includes unknown command warning when provided', () => {
    const help = formatHelp('bogus');
    expect(help).toContain('bogus');
    expect(help).toContain('Unknown');
  });
});
