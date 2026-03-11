import { open, readdir, stat } from 'node:fs/promises';
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

export async function readLogTail(filePath: string, maxBytes = 8192): Promise<string> {
  try {
    const stats = await stat(filePath);
    const fileSize = stats.size;
    if (fileSize === 0) return '';

    const fh = await open(filePath, 'r');
    try {
      if (fileSize <= maxBytes) {
        const buf = Buffer.alloc(fileSize);
        await fh.read(buf, 0, fileSize, 0);
        return buf.toString('utf-8');
      }
      const offset = fileSize - maxBytes;
      const buf = Buffer.alloc(maxBytes);
      await fh.read(buf, 0, maxBytes, offset);
      const raw = buf.toString('utf-8');
      // Drop the first partial line
      const firstNewline = raw.indexOf('\n');
      return firstNewline === -1 ? raw : raw.slice(firstNewline + 1);
    } finally {
      await fh.close();
    }
  } catch {
    return '';
  }
}

export interface PhaseInfo {
  phase: string;
  startedAt: Date | null;
}

function extractTextFromJsonLine(line: string): string | null {
  try {
    const obj = JSON.parse(line);
    // Flat text entry: {"type":"text","text":"..."}
    if (obj.type === 'text' && typeof obj.text === 'string') {
      return obj.text;
    }
    // Nested message entry: {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
    const content = obj.message?.content ?? obj.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          return block.text;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function extractTimestampFromJsonLine(line: string): Date | null {
  try {
    const obj = JSON.parse(line);
    if (typeof obj.timestamp === 'string') {
      const d = new Date(obj.timestamp);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

const PHASE_INLINE_RE = /\[PHASE]\s*Entering:\s*(\w+)/;

export function parseCurrentPhase(content: string): PhaseInfo | null {
  if (!content) return null;
  const lines = content.split('\n');
  let lastPhase: string | null = null;
  let lastTimestamp: Date | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const text = extractTextFromJsonLine(line);
    if (text) {
      const match = text.match(PHASE_INLINE_RE);
      if (match) {
        lastPhase = match[1];
        lastTimestamp = extractTimestampFromJsonLine(line);
      }
    } else {
      // Try raw text matching for non-JSON lines
      const match = line.match(PHASE_INLINE_RE);
      if (match) {
        lastPhase = match[1];
        lastTimestamp = null;
      }
    }
  }

  return lastPhase ? { phase: lastPhase, startedAt: lastTimestamp } : null;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1');
}

export function parseLastLogLine(content: string, maxWidth = 0): string | null {
  if (!content) return null;
  const lines = content.split('\n');
  let lastText: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const text = extractTextFromJsonLine(line);
    if (text && text.trim()) {
      lastText = text.trim();
    }
  }

  if (!lastText) return null;

  lastText = stripMarkdown(lastText);

  // Handle multiline: take the last non-empty line
  const textLines = lastText.split('\n').filter((l) => l.trim());
  if (textLines.length > 0) {
    lastText = textLines[textLines.length - 1].trim();
  }

  if (maxWidth > 0 && lastText.length > maxWidth) {
    return lastText.slice(0, maxWidth - 1) + '…';
  }

  return lastText;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s ago`;
  }
  return `${seconds}s ago`;
}

export interface MonitorData {
  status: 'RUNNING' | 'STOPPED';
  done: number;
  total: number;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  phases: string[];
  currentPhaseStarted: Date | null;
  lastLogLine: string | null;
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

  if (data.currentPhaseStarted && data.phases.length > 0) {
    const elapsed = Date.now() - data.currentPhaseStarted.getTime();
    const currentPhase = data.phases[data.phases.length - 1];
    lines.push(`Current phase: ${currentPhase} (${formatElapsed(elapsed)})`);
  }

  if (data.lastLogLine) {
    lines.push(`Last output: ${data.lastLogLine}`);
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
  let currentPhaseStarted: Date | null = null;
  let lastLogLine: string | null = null;

  const latestLog = await findLatestLogFile(logsDir);
  if (latestLog) {
    currentTaskId = extractTaskIdFromLog(latestLog);
    if (currentTaskId) {
      const task = tasks.find((t) => t.id === currentTaskId);
      if (task) {
        currentTaskTitle = task.title;
      }
    }

    const logContent = await readLogTail(join(logsDir, latestLog));
    if (logContent) {
      phases = parsePhases(logContent);
      const phaseInfo = parseCurrentPhase(logContent);
      if (phaseInfo) {
        currentPhaseStarted = phaseInfo.startedAt;
      }
      const termWidth = process.stdout.columns || 80;
      lastLogLine = parseLastLogLine(logContent, termWidth);
    }
  }

  return formatMonitorOutput({
    status,
    done: counts.DONE,
    total,
    currentTaskId,
    currentTaskTitle,
    phases,
    currentPhaseStarted,
    lastLogLine,
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
