import { registerProvider, listProviders, getProvider } from '../core/agent-provider.js';
import { claudeProvider } from './claude.js';
import { geminiProvider } from './gemini.js';
import { codexProvider } from './codex.js';

let initialized = false;

export function ensureProvidersRegistered(): void {
  if (initialized) return;
  registerProvider('claude', claudeProvider);
  registerProvider('gemini', geminiProvider);
  registerProvider('codex', codexProvider);
  initialized = true;
}

export function resetProviderInit(): void {
  initialized = false;
}

export { getProvider, listProviders };
