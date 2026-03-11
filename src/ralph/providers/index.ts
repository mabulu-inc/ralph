import { registerProvider, listProviders, getProvider } from '../core/agent-provider.js';
import { claudeProvider } from './claude.js';
import { geminiProvider } from './gemini.js';
import { codexProvider } from './codex.js';
import { continueProvider } from './continue.js';
import { cursorProvider } from './cursor.js';

let initialized = false;

export function ensureProvidersRegistered(): void {
  if (initialized) return;
  registerProvider('claude', claudeProvider);
  registerProvider('gemini', geminiProvider);
  registerProvider('codex', codexProvider);
  registerProvider('continue', continueProvider);
  registerProvider('cursor', cursorProvider);
  initialized = true;
}

export function resetProviderInit(): void {
  initialized = false;
}

export { getProvider, listProviders };
