import type { AgentProvider, BuildArgsOptions } from '../core/agent-provider.js';

export const continueProvider: AgentProvider = {
  binary: 'cn',
  outputFormat: ['--output-format', 'stream-json'],
  textOutputFormat: ['--output-format', 'text'],
  supportsMaxTurns: true,
  supportsSystemPrompt: false,
  systemPromptFlag: '',

  buildArgs(prompt: string, options: BuildArgsOptions): string[] {
    const args = ['-p', ...options.outputFormat];

    if (options.maxTurns !== undefined) {
      args.push('--max-turns', String(options.maxTurns));
    }

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
