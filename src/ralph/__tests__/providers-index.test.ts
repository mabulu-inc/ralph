import { describe, it, expect, beforeEach } from 'vitest';
import { resetRegistry, getProvider, listProviders } from '../core/agent-provider.js';
import { ensureProvidersRegistered, resetProviderInit } from '../providers/index.js';
import { claudeProvider } from '../providers/claude.js';
import { geminiProvider } from '../providers/gemini.js';
import { codexProvider } from '../providers/codex.js';
import { continueProvider } from '../providers/continue.js';
import { cursorProvider } from '../providers/cursor.js';

describe('ensureProvidersRegistered', () => {
  beforeEach(() => {
    resetRegistry();
    resetProviderInit();
  });

  it('registers the claude provider', () => {
    ensureProvidersRegistered();
    expect(getProvider('claude')).toBe(claudeProvider);
  });

  it('registers the gemini provider', () => {
    ensureProvidersRegistered();
    expect(getProvider('gemini')).toBe(geminiProvider);
  });

  it('registers the codex provider', () => {
    ensureProvidersRegistered();
    expect(getProvider('codex')).toBe(codexProvider);
  });

  it('registers the continue provider', () => {
    ensureProvidersRegistered();
    expect(getProvider('continue')).toBe(continueProvider);
  });

  it('registers the cursor provider', () => {
    ensureProvidersRegistered();
    expect(getProvider('cursor')).toBe(cursorProvider);
  });

  it('is idempotent — calling twice does not throw', () => {
    ensureProvidersRegistered();
    ensureProvidersRegistered();
    expect(listProviders()).toEqual(['claude', 'gemini', 'codex', 'continue', 'cursor']);
  });

  it('registers all five built-in providers', () => {
    ensureProvidersRegistered();
    expect(listProviders()).toEqual(['claude', 'gemini', 'codex', 'continue', 'cursor']);
  });
});
