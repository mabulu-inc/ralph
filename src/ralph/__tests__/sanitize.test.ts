import { describe, expect, it } from 'vitest';
import {
  assertSafeTaskId,
  assertSafeGitRef,
  assertSafeFilePath,
  assertSafeShellArg,
} from '../core/sanitize.js';
import {
  findCommitByMessage,
  hasUnpushedCommits,
  pushToRemote,
  addAndCommit,
  detectTrackingRemote,
} from '../core/git.js';

describe('sanitize', () => {
  describe('assertSafeTaskId', () => {
    it('accepts valid task IDs', () => {
      expect(() => assertSafeTaskId('T-001')).not.toThrow();
      expect(() => assertSafeTaskId('T-999')).not.toThrow();
      expect(() => assertSafeTaskId('T-1234')).not.toThrow();
    });

    it('rejects empty string', () => {
      expect(() => assertSafeTaskId('')).toThrow(/Invalid task ID/);
    });

    it('rejects IDs without T- prefix', () => {
      expect(() => assertSafeTaskId('001')).toThrow(/Invalid task ID/);
      expect(() => assertSafeTaskId('X-001')).toThrow(/Invalid task ID/);
    });

    it('rejects IDs with shell metacharacters', () => {
      expect(() => assertSafeTaskId('T-001; rm -rf /')).toThrow(/Invalid task ID/);
      expect(() => assertSafeTaskId('T-001$(evil)')).toThrow(/Invalid task ID/);
      expect(() => assertSafeTaskId('T-001`evil`')).toThrow(/Invalid task ID/);
    });

    it('rejects IDs with newlines', () => {
      expect(() => assertSafeTaskId('T-001\nmalicious')).toThrow(/Invalid task ID/);
    });
  });

  describe('assertSafeGitRef', () => {
    it('accepts valid git ref names', () => {
      expect(() => assertSafeGitRef('main')).not.toThrow();
      expect(() => assertSafeGitRef('feature/my-branch')).not.toThrow();
      expect(() => assertSafeGitRef('origin')).not.toThrow();
      expect(() => assertSafeGitRef('v1.0.0')).not.toThrow();
    });

    it('rejects empty string', () => {
      expect(() => assertSafeGitRef('')).toThrow(/Invalid git ref/);
    });

    it('rejects refs with shell metacharacters', () => {
      expect(() => assertSafeGitRef('main; rm -rf /')).toThrow(/Invalid git ref/);
      expect(() => assertSafeGitRef('$(evil)')).toThrow(/Invalid git ref/);
      expect(() => assertSafeGitRef('`evil`')).toThrow(/Invalid git ref/);
    });

    it('rejects refs with double dots (path traversal)', () => {
      expect(() => assertSafeGitRef('main..evil')).toThrow(/Invalid git ref/);
    });

    it('rejects refs with control characters', () => {
      expect(() => assertSafeGitRef('main\x00evil')).toThrow(/Invalid git ref/);
      expect(() => assertSafeGitRef('main\nevil')).toThrow(/Invalid git ref/);
    });

    it('rejects refs starting with a dash (option injection)', () => {
      expect(() => assertSafeGitRef('-branch')).toThrow(/Invalid git ref/);
      expect(() => assertSafeGitRef('--upload-pack=evil')).toThrow(/Invalid git ref/);
    });
  });

  describe('assertSafeFilePath', () => {
    it('accepts valid file paths', () => {
      expect(() => assertSafeFilePath('docs/tasks/T-001.md')).not.toThrow();
      expect(() => assertSafeFilePath('src/ralph/core/git.ts')).not.toThrow();
      expect(() => assertSafeFilePath('file.txt')).not.toThrow();
    });

    it('rejects empty string', () => {
      expect(() => assertSafeFilePath('')).toThrow(/Invalid file path/);
    });

    it('rejects paths with null bytes', () => {
      expect(() => assertSafeFilePath('file\x00.txt')).toThrow(/Invalid file path/);
    });

    it('rejects paths with newlines', () => {
      expect(() => assertSafeFilePath('file\n.txt')).toThrow(/Invalid file path/);
    });

    it('rejects paths starting with a dash', () => {
      expect(() => assertSafeFilePath('-file.txt')).toThrow(/Invalid file path/);
    });
  });

  describe('assertSafeShellArg', () => {
    it('accepts normal text', () => {
      expect(() => assertSafeShellArg('hello world')).not.toThrow();
      expect(() => assertSafeShellArg('T-001: Add feature X')).not.toThrow();
      expect(() => assertSafeShellArg('some commit message with punctuation!')).not.toThrow();
    });

    it('rejects empty string', () => {
      expect(() => assertSafeShellArg('')).toThrow(/Invalid argument/);
    });

    it('rejects strings with null bytes', () => {
      expect(() => assertSafeShellArg('hello\x00world')).toThrow(/Invalid argument/);
    });

    it('rejects strings starting with a dash (option injection)', () => {
      expect(() => assertSafeShellArg('-p')).toThrow(/Invalid argument/);
      expect(() => assertSafeShellArg('--flag')).toThrow(/Invalid argument/);
    });

    it('accepts strings with dashes not at the start', () => {
      expect(() => assertSafeShellArg('T-001: some-title')).not.toThrow();
    });
  });

  describe('git integration — sanitization at call sites', () => {
    it('findCommitByMessage rejects dangerous patterns', async () => {
      await expect(findCommitByMessage('/tmp', '--evil')).rejects.toThrow(/Invalid argument/);
    });

    it('hasUnpushedCommits rejects dangerous remote names', async () => {
      await expect(hasUnpushedCommits('/tmp', '--upload-pack=evil', 'main')).rejects.toThrow(
        /Invalid git ref/,
      );
    });

    it('hasUnpushedCommits rejects dangerous branch names', async () => {
      await expect(hasUnpushedCommits('/tmp', 'origin', '$(evil)')).rejects.toThrow(
        /Invalid git ref/,
      );
    });

    it('pushToRemote rejects dangerous remote names', async () => {
      await expect(pushToRemote('/tmp', 'origin; rm -rf /', 'main')).rejects.toThrow(
        /Invalid git ref/,
      );
    });

    it('addAndCommit rejects dangerous file paths', async () => {
      await expect(addAndCommit('/tmp', ['-file.txt'], 'msg')).rejects.toThrow(/Invalid file path/);
    });

    it('addAndCommit rejects dangerous commit messages', async () => {
      await expect(addAndCommit('/tmp', ['file.txt'], '--amend')).rejects.toThrow(
        /Invalid argument/,
      );
    });

    it('detectTrackingRemote rejects dangerous branch names', async () => {
      await expect(detectTrackingRemote('/tmp', '--evil')).rejects.toThrow(/Invalid git ref/);
    });
  });
});
