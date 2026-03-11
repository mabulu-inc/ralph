import { join } from 'node:path';
import { killProcessTree } from '../core/process.js';
import { readPidFile, removePidFile } from '../core/pid-file.js';

export function getPidFilePath(projectDir: string): string {
  return join(projectDir, '.ralph-logs', 'ralph.pid');
}

export async function run(_args: string[], cwd?: string): Promise<void> {
  const projectDir = cwd ?? process.cwd();
  const pidPath = getPidFilePath(projectDir);

  const pid = await readPidFile(pidPath);

  if (pid === null) {
    console.log('Ralph is not running');
    return;
  }

  try {
    await killProcessTree(pid);
    await removePidFile(pidPath);
    console.log('Killed 1 process');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to kill process ${pid}: ${message}`);
  }
}
