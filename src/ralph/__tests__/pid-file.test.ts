import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writePidFile, readPidFile, removePidFile } from '../core/pid-file.js';

describe('pid-file', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    for (const d of dirs) {
      await rm(d, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  async function makeTmpDir(): Promise<string> {
    const dir = join(
      tmpdir(),
      `ralph-pid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  describe('writePidFile', () => {
    it('writes the current PID to the file', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'ralph.pid');

      await writePidFile(pidPath, 12345);

      const content = await readFile(pidPath, 'utf-8');
      expect(content.trim()).toBe('12345');
    });

    it('creates parent directories if they do not exist', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'nested', 'deep', 'ralph.pid');

      await writePidFile(pidPath, 99);

      const content = await readFile(pidPath, 'utf-8');
      expect(content.trim()).toBe('99');
    });

    it('overwrites an existing PID file', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'ralph.pid');

      await writePidFile(pidPath, 111);
      await writePidFile(pidPath, 222);

      const content = await readFile(pidPath, 'utf-8');
      expect(content.trim()).toBe('222');
    });
  });

  describe('readPidFile', () => {
    it('returns the PID from the file when the process is alive', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'ralph.pid');

      // Use current process PID — guaranteed to be alive
      const myPid = process.pid;
      await writePidFile(pidPath, myPid);

      const pid = await readPidFile(pidPath);
      expect(pid).toBe(myPid);
    });

    it('returns null when the file does not exist', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'nonexistent.pid');

      const pid = await readPidFile(pidPath);
      expect(pid).toBeNull();
    });

    it('returns null when the file contains invalid content', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'ralph.pid');

      const { writeFile } = await import('node:fs/promises');
      await writeFile(pidPath, 'not-a-number');

      const pid = await readPidFile(pidPath);
      expect(pid).toBeNull();
    });

    it('returns null when the PID process is not alive (stale file)', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'ralph.pid');

      // Use an extremely high PID that is almost certainly not running
      await writePidFile(pidPath, 4999999);

      const pid = await readPidFile(pidPath);
      expect(pid).toBeNull();
    });
  });

  describe('removePidFile', () => {
    it('removes the PID file', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'ralph.pid');

      await writePidFile(pidPath, 123);
      await removePidFile(pidPath);

      const pid = await readPidFile(pidPath);
      expect(pid).toBeNull();
    });

    it('does not throw when the file does not exist', async () => {
      const dir = await makeTmpDir();
      const pidPath = join(dir, 'nonexistent.pid');

      await expect(removePidFile(pidPath)).resolves.toBeUndefined();
    });
  });
});
