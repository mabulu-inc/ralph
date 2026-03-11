import type { AgentProvider, BuildArgsOptions } from '../core/agent-provider.js';

export const cursorProvider: AgentProvider = {
  binary: 'cursor',
  outputFormat: ['--output-format', 'stream-json'],
  supportsMaxTurns: false,
  supportsSystemPrompt: false,
  systemPromptFlag: '',
  instructionsFile: '.cursor/rules/',

  buildArgs(prompt: string, options: BuildArgsOptions): string[] {
    const args = ['-p', ...options.outputFormat];

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
