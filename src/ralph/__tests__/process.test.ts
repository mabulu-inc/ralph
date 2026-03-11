import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  spawnWithCapture,
  killProcessTree,
  getChildPids,
  findProcessesByPattern,
  monitorProcess,
} from '../core/process.js';

describe('process management', () => {
  const cleanupPids: number[] = [];
  const cleanupDirs: string[] = [];

  afterEach(async () => {
    for (const pid of cleanupPids) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already dead
      }
    }
    cleanupPids.length = 0;
    for (const dir of cleanupDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    cleanupDirs.length = 0;
  });

  describe('spawnWithCapture', () => {
    it('spawns a process and captures output to a file', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'ralph-proc-'));
      cleanupDirs.push(dir);
      const logFile = join(dir, 'output.log');

      const child = spawnWithCapture('echo', ['hello world'], { logFile });
      cleanupPids.push(child.pid!);

      // Wait for process to finish
      await new Promise<void>((resolve) => {
        child.on('close', () => resolve());
      });

      const content = await readFile(logFile, 'utf-8');
      expect(content).toContain('hello world');
    });

    it('captures stderr to the same file', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'ralph-proc-'));
      cleanupDirs.push(dir);
      const logFile = join(dir, 'output.log');

      const child = spawnWithCapture('node', ['-e', 'process.stderr.write("err msg")'], {
        logFile,
      });
      cleanupPids.push(child.pid!);

      await new Promise<void>((resolve) => {
        child.on('close', () => resolve());
      });

      const content = await readFile(logFile, 'utf-8');
      expect(content).toContain('err msg');
    });

    it('passes cwd option to child process', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'ralph-proc-'));
      cleanupDirs.push(dir);
      const logFile = join(dir, 'output.log');

      const child = spawnWithCapture('pwd', [], { logFile, cwd: dir });
      cleanupPids.push(child.pid!);

      await new Promise<void>((resolve) => {
        child.on('close', () => resolve());
      });

      const content = await readFile(logFile, 'utf-8');
      // realpath resolves /tmp -> /private/tmp on macOS
      expect(content.trim()).toContain('ralph-proc-');
    });

    it('returns a ChildProcess with a valid pid', () => {
      const child = spawnWithCapture('sleep', ['0.01'], {});
      cleanupPids.push(child.pid!);
      expect(child.pid).toBeGreaterThan(0);
    });
  });

  describe('killProcessTree', () => {
    it('kills a running process', async () => {
      const child = spawnWithCapture('sleep', ['60'], {});
      const pid = child.pid!;
      cleanupPids.push(pid);

      await killProcessTree(pid);

      // Give OS time to reap
      await new Promise((r) => setTimeout(r, 100));

      // Process should be dead
      expect(() => process.kill(pid, 0)).toThrow();
    });

    it('kills child processes (process tree)', async () => {
      const child = spawnWithCapture('sh', ['-c', 'sleep 60 & sleep 60 & wait'], {});
      const pid = child.pid!;
      cleanupPids.push(pid);

      // Give children time to start
      await new Promise((r) => setTimeout(r, 300));

      // Find child PIDs before killing
      const childPids = await getChildPids(pid);
      expect(childPids.length).toBeGreaterThan(0);
      for (const cpid of childPids) {
        cleanupPids.push(cpid);
      }

      await killProcessTree(pid);
      await new Promise((r) => setTimeout(r, 300));

      // Parent should be dead
      expect(() => process.kill(pid, 0)).toThrow();

      // All children should also be dead
      for (const cpid of childPids) {
        expect(() => process.kill(cpid, 0)).toThrow();
      }
    });

    it('kills nested grandchild processes', async () => {
      // sh spawns sh which spawns sleep — a 3-level tree
      const child = spawnWithCapture('sh', ['-c', 'sh -c "sleep 60 & wait" & wait'], {});
      const pid = child.pid!;
      cleanupPids.push(pid);

      await new Promise((r) => setTimeout(r, 300));

      // Collect all descendants
      const allDescendants = await getChildPids(pid);
      for (const cpid of allDescendants) {
        cleanupPids.push(cpid);
      }

      await killProcessTree(pid);
      await new Promise((r) => setTimeout(r, 300));

      expect(() => process.kill(pid, 0)).toThrow();
      for (const cpid of allDescendants) {
        expect(() => process.kill(cpid, 0)).toThrow();
      }
    });

    it('does not throw when process is already dead', async () => {
      const child = spawnWithCapture('echo', ['done'], {});
      const pid = child.pid!;

      await new Promise<void>((resolve) => {
        child.on('close', () => resolve());
      });

      // Should not throw
      await expect(killProcessTree(pid)).resolves.toBeUndefined();
    });

    it('sends SIGTERM first then SIGKILL after grace period', async () => {
      // Create a process that ignores SIGTERM
      const child = spawnWithCapture(
        'node',
        ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'],
        {},
      );
      const pid = child.pid!;
      cleanupPids.push(pid);

      await new Promise((r) => setTimeout(r, 100));

      // Kill with a short grace period
      await killProcessTree(pid, { gracePeriodMs: 200 });
      await new Promise((r) => setTimeout(r, 100));

      expect(() => process.kill(pid, 0)).toThrow();
    });
  });

  describe('getChildPids', () => {
    it('returns child PIDs of a process', async () => {
      const child = spawnWithCapture('sh', ['-c', 'sleep 60 & sleep 60 & wait'], {});
      const pid = child.pid!;
      cleanupPids.push(pid);

      await new Promise((r) => setTimeout(r, 300));

      const childPids = await getChildPids(pid);
      expect(childPids.length).toBeGreaterThanOrEqual(2);

      for (const cpid of childPids) {
        cleanupPids.push(cpid);
        expect(cpid).toBeGreaterThan(0);
        expect(cpid).not.toBe(pid);
      }

      // Cleanup
      await killProcessTree(pid);
    });

    it('returns empty array for a process with no children', async () => {
      const child = spawnWithCapture('sleep', ['60'], {});
      const pid = child.pid!;
      cleanupPids.push(pid);

      await new Promise((r) => setTimeout(r, 100));

      const childPids = await getChildPids(pid);
      expect(childPids).toEqual([]);

      await killProcessTree(pid);
    });

    it('returns empty array for a nonexistent PID', async () => {
      const childPids = await getChildPids(999999999);
      expect(childPids).toEqual([]);
    });
  });

  describe('findProcessesByPattern', () => {
    it('finds processes matching a command pattern', async () => {
      // Spawn a process with a unique marker in its args
      const marker = `ralph-test-marker-${Date.now()}`;
      const child = spawnWithCapture(
        'node',
        ['-e', `// ${marker}\nsetInterval(() => {}, 1000)`],
        {},
      );
      cleanupPids.push(child.pid!);

      await new Promise((r) => setTimeout(r, 100));

      const pids = await findProcessesByPattern(marker);
      expect(pids).toContain(child.pid!);
    });

    it('returns empty array when no match', async () => {
      const pids = await findProcessesByPattern('nonexistent-process-xyz-999999');
      expect(pids).toEqual([]);
    });

    it('excludes the current process', async () => {
      // The grep/ps command itself should not appear
      const pids = await findProcessesByPattern('nonexistent-process-abc-888888');
      expect(pids).not.toContain(process.pid);
    });
  });

  describe('monitorProcess', () => {
    it('resolves with exit code when process completes', async () => {
      const child = spawnWithCapture('echo', ['hi'], {});
      cleanupPids.push(child.pid!);

      const result = await monitorProcess(child);
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });

    it('resolves with non-zero exit code on failure', async () => {
      const child = spawnWithCapture('node', ['-e', 'process.exit(42)'], {});
      cleanupPids.push(child.pid!);

      const result = await monitorProcess(child);
      expect(result.exitCode).toBe(42);
      expect(result.timedOut).toBe(false);
    });

    it('kills and returns timedOut when timeout is exceeded', async () => {
      const child = spawnWithCapture('sleep', ['60'], {});
      cleanupPids.push(child.pid!);

      const result = await monitorProcess(child, { timeoutMs: 200 });
      expect(result.timedOut).toBe(true);
    });

    it('calls onOutput callback for stdout data', async () => {
      const child = spawnWithCapture('echo', ['callback-test'], {});
      cleanupPids.push(child.pid!);

      const chunks: string[] = [];
      await monitorProcess(child, {
        onOutput: (data) => chunks.push(data),
      });

      expect(chunks.join('')).toContain('callback-test');
    });
  });
});
