const COMMANDS = ['init', 'loop', 'monitor', 'kill', 'milestones', 'shas', 'cost'] as const;
type Command = (typeof COMMANDS)[number];

export type DispatchResult =
  | { action: 'help'; unknown?: string }
  | { action: Command; args: string[] };

export function dispatch(argv: string[]): DispatchResult {
  const first = argv[0];

  if (!first || first === '--help' || first === '-h') {
    return { action: 'help' };
  }

  if (COMMANDS.includes(first as Command)) {
    return { action: first as Command, args: argv.slice(1) };
  }

  return { action: 'help', unknown: first };
}

export function formatHelp(unknown?: string): string {
  const lines: string[] = [];

  if (unknown) {
    lines.push(`Unknown command: ${unknown}`);
    lines.push('');
  }

  lines.push('Usage: ralph <command> [options]');
  lines.push('');
  lines.push('Commands:');
  lines.push('  init        Bootstrap a new Ralph project');
  lines.push('  loop        Run the AI development loop');
  lines.push('  monitor     Show real-time progress');
  lines.push('  kill        Stop ralph and all child processes');
  lines.push('  milestones  Generate milestones summary');
  lines.push('  shas        Backfill commit SHAs in task files');
  lines.push('  cost        Calculate token usage and costs');

  return lines.join('\n');
}
