import { describe, it, expect, beforeEach } from 'vitest';
import { resetRegistry, getProvider, listProviders } from '../core/agent-provider.js';
import { ensureProvidersRegistered, resetProviderInit } from '../providers/index.js';
import { claudeProvider } from '../providers/claude.js';
import { geminiProvider } from '../providers/gemini.js';
import { codexProvider } from '../providers/codex.js';

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

  it('is idempotent — calling twice does not throw', () => {
    ensureProvidersRegistered();
    ensureProvidersRegistered();
    expect(listProviders()).toEqual(['claude', 'gemini', 'codex']);
  });

  it('registers claude, gemini, and codex as built-in providers', () => {
    ensureProvidersRegistered();
    expect(listProviders()).toEqual(['claude', 'gemini', 'codex']);
  });
});
