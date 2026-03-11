import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writePidFile(pidPath: string, pid: number): Promise<void> {
  await mkdir(dirname(pidPath), { recursive: true });
  await writeFile(pidPath, String(pid), 'utf-8');
}

export async function readPidFile(pidPath: string): Promise<number | null> {
  let content: string;
  try {
    content = await readFile(pidPath, 'utf-8');
  } catch {
    return null;
  }

  const pid = parseInt(content.trim(), 10);
  if (isNaN(pid) || pid <= 0) {
    return null;
  }

  // Check if the process is still alive
  try {
    process.kill(pid, 0);
  } catch {
    return null; // stale PID file
  }

  return pid;
}

export async function removePidFile(pidPath: string): Promise<void> {
  try {
    await unlink(pidPath);
  } catch {
    // file doesn't exist, that's fine
  }
}
