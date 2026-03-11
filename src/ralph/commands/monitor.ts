import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { scanTasks, countByStatus, type Task } from '../core/tasks.js';
import { readPidFile } from '../core/pid-file.js';

const ALL_PHASES = ['Boot', 'Red', 'Green', 'Verify', 'Commit'] as const;

const PHASE_RE = /\[PHASE]\s*Entering:\s*(\w+)/g;

export function parsePhases(content: string): string[] {
  const phases: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = PHASE_RE.exec(content)) !== null) {
    phases.push(match[1]);
  }
  PHASE_RE.lastIndex = 0;
  return phases;
}

export function formatPhaseTimeline(phases: string[]): string {
  const phaseSet = new Set(phases);
  return ALL_PHASES.map((p) => (phaseSet.has(p) ? `● ${p}` : `○ ${p}`)).join(' → ');
}

export function formatProgressBar(done: number, total: number, width = 20): string {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${done}/${total} (${pct}%)`;
}

export function detectStatus(ralphPids: number[]): 'RUNNING' | 'STOPPED' {
  return ralphPids.length > 0 ? 'RUNNING' : 'STOPPED';
}

export async function findLatestLogFile(logsDir: string): Promise<string | null> {
  try {
    const entries = await readdir(logsDir);
    const logFiles = entries.filter((f) => f.endsWith('.jsonl')).sort();
    return logFiles.length > 0 ? logFiles[logFiles.length - 1] : null;
  } catch {
    return null;
  }
}

export function extractTaskIdFromLog(filename: string): string | null {
  const match = filename.match(/^(T-\d+)/);
  return match ? match[1] : null;
}

export interface MonitorData {
  status: 'RUNNING' | 'STOPPED';
  done: number;
  total: number;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  phases: string[];
}

export function formatMonitorOutput(data: MonitorData): string {
  const lines: string[] = [];
  lines.push(`Status: ${data.status}`);
  lines.push(`Progress: ${formatProgressBar(data.done, data.total)}`);

  if (data.currentTaskId) {
    const title = data.currentTaskTitle ? `: ${data.currentTaskTitle}` : '';
    lines.push(`Current task: ${data.currentTaskId}${title}`);
  }

  if (data.phases.length > 0) {
    lines.push(`Phases: ${formatPhaseTimeline(data.phases)}`);
  }

  return lines.join('\n');
}

export interface RunResult {
  watching: boolean;
  stop?: () => void;
}

export async function renderDashboard(tasksDir: string, logsDir: string): Promise<string> {
  let tasks: Task[];
  try {
    tasks = await scanTasks(tasksDir);
  } catch {
    return 'No tasks directory found';
  }

  if (tasks.length === 0) {
    return 'No tasks found';
  }

  const counts = countByStatus(tasks);
  const total = counts.DONE + counts.TODO;

  const pidPath = join(tasksDir, '..', '..', '.ralph-logs', 'ralph.pid');
  const ralphPid = await readPidFile(pidPath);
  const status = detectStatus(ralphPid !== null ? [ralphPid] : []);

  let currentTaskId: string | null = null;
  let currentTaskTitle: string | null = null;
  let phases: string[] = [];

  const latestLog = await findLatestLogFile(logsDir);
  if (latestLog) {
    currentTaskId = extractTaskIdFromLog(latestLog);
    if (currentTaskId) {
      const task = tasks.find((t) => t.id === currentTaskId);
      if (task) {
        currentTaskTitle = task.title;
      }
    }

    try {
      const logContent = await readFile(join(logsDir, latestLog), 'utf-8');
      phases = parsePhases(logContent);
    } catch {
      // log file may have been removed
    }
  }

  return formatMonitorOutput({
    status,
    done: counts.DONE,
    total,
    currentTaskId,
    currentTaskTitle,
    phases,
  });
}

export async function run(args: string[], cwd?: string): Promise<RunResult> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: ralph monitor [-w|--watch] [-i|--interval <seconds>]');
    return { watching: false };
  }

  const projectDir = cwd ?? process.cwd();
  const tasksDir = join(projectDir, 'docs', 'tasks');
  const logsDir = join(projectDir, '.ralph-logs');

  const output = await renderDashboard(tasksDir, logsDir);
  const isWatch = args.includes('-w') || args.includes('--watch');

  if (isWatch) {
    console.clear();
    console.log(output);

    const intervalIdx = args.indexOf('-i') !== -1 ? args.indexOf('-i') : args.indexOf('--interval');
    const intervalSec = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1], 10) || 5 : 5;

    const refresh = async () => {
      const refreshOutput = await renderDashboard(tasksDir, logsDir);
      console.clear();
      console.log(refreshOutput);
    };

    const intervalId = setInterval(refresh, intervalSec * 1000);

    const stop = () => {
      clearInterval(intervalId);
    };

    process.on('SIGINT', () => {
      stop();
      process.exit(0);
    });

    return { watching: true, stop };
  }

  console.log(output);
  return { watching: false };
}
