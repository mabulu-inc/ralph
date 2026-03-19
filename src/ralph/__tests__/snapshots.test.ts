import { describe, it, expect, beforeEach } from 'vitest';

import {
  computeSimilarity,
  getSnapshotsForType,
  registerSnapshot,
  clearSnapshots,
  getAllSnapshots,
  getCurrentVersion,
  initializeCurrentSnapshots,
  type TemplateSnapshot,
} from '../templates/snapshots/index.js';

describe('computeSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(computeSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    const a = 'aaa\nbbb\nccc';
    const b = 'xxx\nyyy\nzzz';
    expect(computeSimilarity(a, b)).toBe(0);
  });

  it('returns a value between 0 and 1 for partially similar strings', () => {
    const a = 'line 1\nline 2\nline 3\nline 4';
    const b = 'line 1\nline 2\nline X\nline Y';
    const similarity = computeSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it('handles empty strings', () => {
    expect(computeSimilarity('', '')).toBe(1);
    expect(computeSimilarity('content', '')).toBe(0);
    expect(computeSimilarity('', 'content')).toBe(0);
  });

  it('is symmetric', () => {
    const a = 'line 1\nline 2\nline 3';
    const b = 'line 1\nline X\nline 3';
    expect(computeSimilarity(a, b)).toBe(computeSimilarity(b, a));
  });

  it('uses line-level comparison', () => {
    const template = '# Title\n\nLine A\nLine B\nLine C\nLine D';
    const withOneChange = '# Title\n\nLine A\nLine MODIFIED\nLine C\nLine D';
    const similarity = computeSimilarity(template, withOneChange);
    // 5 out of 6 lines match → ~0.83
    expect(similarity).toBeGreaterThan(0.7);
  });
});

describe('snapshot registry', () => {
  beforeEach(() => {
    clearSnapshots();
  });

  it('returns empty array for unknown type', () => {
    expect(getSnapshotsForType('nonexistent')).toEqual([]);
  });

  it('registers and retrieves snapshots by type', () => {
    const snapshot: TemplateSnapshot = {
      type: 'system-prompt',
      version: '0.5.0',
      content: '# System Prompt v0.5.0',
    };
    registerSnapshot(snapshot);

    const results = getSnapshotsForType('system-prompt');
    expect(results).toHaveLength(1);
    expect(results[0].version).toBe('0.5.0');
    expect(results[0].content).toBe('# System Prompt v0.5.0');
  });

  it('returns multiple versions for the same type', () => {
    registerSnapshot({ type: 'boot-prompt', version: '0.5.0', content: 'v0.5' });
    registerSnapshot({ type: 'boot-prompt', version: '0.6.0', content: 'v0.6' });
    registerSnapshot({ type: 'boot-prompt', version: '0.6.2', content: 'v0.6.2' });

    const results = getSnapshotsForType('boot-prompt');
    expect(results).toHaveLength(3);
  });

  it('does not return snapshots of a different type', () => {
    registerSnapshot({ type: 'system-prompt', version: '0.5.0', content: 'sys' });
    registerSnapshot({ type: 'boot-prompt', version: '0.5.0', content: 'boot' });

    expect(getSnapshotsForType('system-prompt')).toHaveLength(1);
    expect(getSnapshotsForType('boot-prompt')).toHaveLength(1);
  });

  it('clearSnapshots removes all registered snapshots', () => {
    registerSnapshot({ type: 'system-prompt', version: '0.5.0', content: 'content' });
    clearSnapshots();
    expect(getAllSnapshots()).toHaveLength(0);
  });

  it('getAllSnapshots returns all registered snapshots', () => {
    registerSnapshot({ type: 'system-prompt', version: '0.5.0', content: 'sys' });
    registerSnapshot({ type: 'boot-prompt', version: '0.5.0', content: 'boot' });
    expect(getAllSnapshots()).toHaveLength(2);
  });

  it('getCurrentVersion returns a valid semver string', () => {
    const version = getCurrentVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('initializeCurrentSnapshots registers snapshots for current templates', () => {
    initializeCurrentSnapshots();
    const all = getAllSnapshots();
    expect(all.length).toBeGreaterThan(0);

    // Should have system-prompt, boot-prompt, methodology, prompts-readme at minimum
    const types = new Set(all.map((s) => s.type));
    expect(types.has('system-prompt')).toBe(true);
    expect(types.has('boot-prompt')).toBe(true);
    expect(types.has('methodology')).toBe(true);
  });
});
