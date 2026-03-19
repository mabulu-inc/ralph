import type { AgentProvider, BuildArgsOptions } from '../core/agent-provider.js';

export const codexProvider: AgentProvider = {
  binary: 'codex',
  outputFormat: ['--json'],
  textOutputFormat: [],
  supportsMaxTurns: false,
  supportsSystemPrompt: false,
  systemPromptFlag: '',

  buildArgs(prompt: string, options: BuildArgsOptions): string[] {
    const args = ['exec', ...options.outputFormat];

    if (options.model) {
      args.push('--model', options.model);
    }

    args.push(prompt);
    return args;
  },

  parseOutput(raw: string): string {
    return raw;
  },
};
