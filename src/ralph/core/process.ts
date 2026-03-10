import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SpawnOptions {
  logFile?: string;
  cwd?: string;
}

export interface MonitorResult {
  exitCode: number | null;
  timedOut: boolean;
}

export interface MonitorOptions {
  timeoutMs?: number;
  onOutput?: (data: string) => void;
}

export interface KillOptions {
  gracePeriodMs?: number;
}

export function spawnWithCapture(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcess {
  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (options.logFile) {
    const stream = createWriteStream(options.logFile, { flags: 'a' });
    child.stdout?.pipe(stream);
    child.stderr?.pipe(stream);
    child.on('close', () => stream.end());
  }

  return child;
}

export async function killProcessTree(pid: number, options?: KillOptions): Promise<void> {
  const gracePeriodMs = options?.gracePeriodMs ?? 5000;

  // Check if process is alive
  try {
    process.kill(pid, 0);
  } catch {
    return; // already dead
  }

  // Send SIGTERM first
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }

  // Wait for graceful shutdown or force kill
  const dead = await waitForDeath(pid, gracePeriodMs);
  if (!dead) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already dead
    }
    await waitForDeath(pid, 1000);
  }
}

async function waitForDeath(pid: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

export async function findProcessesByPattern(pattern: string): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync('ps', ['ax', '-o', 'pid,command']);
    const lines = stdout.split('\n');
    const pids: number[] = [];

    for (const line of lines) {
      if (!line.includes(pattern)) continue;
      const trimmed = line.trim();
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx === -1) continue;
      const pid = parseInt(trimmed.slice(0, spaceIdx), 10);
      if (isNaN(pid)) continue;
      // Exclude own process and the ps command itself
      if (pid === process.pid) continue;
      pids.push(pid);
    }

    return pids;
  } catch {
    return [];
  }
}

export async function monitorProcess(
  child: ChildProcess,
  options?: MonitorOptions,
): Promise<MonitorResult> {
  return new Promise<MonitorResult>((resolve) => {
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (options?.onOutput) {
      const cb = options.onOutput;
      child.stdout?.on('data', (data: Buffer) => cb(data.toString()));
    }

    if (options?.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        killProcessTree(child.pid!, { gracePeriodMs: 500 });
      }, options.timeoutMs);
    }

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: code, timedOut });
    });
  });
}
