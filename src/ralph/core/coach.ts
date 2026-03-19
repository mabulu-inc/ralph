import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanTasks, type Task } from './tasks.js';
import {
  parseLogContent,
  extractPhaseTimeline,
  extractRoleCommentary,
  extractCostAndTurns,
  type RoleEntry,
  type CostTurnsInfo,
  type PhaseEntry,
} from './log-analyzer.js';

export interface CoachingPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export interface CoachingOptions {
  agent: string;
  spawnAgent: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>;
}

export interface CoachingResult {
  mode: 'task' | 'project';
  taskId?: string;
  analysis: string;
  error?: string;
  timestamp: string;
}

interface AttemptSummary {
  file: string;
  phases: PhaseEntry[];
  roles: RoleEntry[];
  costTurns: CostTurnsInfo | null;
  stopReason: string | null;
}

async function findTaskLogs(taskId: string, logsDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(logsDir);
  } catch {
    return [];
  }
  const prefix = `${taskId}-`;
  return entries.filter((f) => f.startsWith(prefix) && f.endsWith('.jsonl')).sort();
}

async function parseAttempt(logPath: string, fileName: string): Promise<AttemptSummary> {
  const content = await readFile(logPath, 'utf-8');
  const entries = parseLogContent(content);
  const phases = extractPhaseTimeline(entries);
  const roles = extractRoleCommentary(entries);
  const costTurns = extractCostAndTurns(entries);

  return {
    file: fileName,
    phases,
    roles,
    costTurns,
    stopReason: costTurns?.stopReason ?? null,
  };
}

function formatAttemptForPrompt(attempt: AttemptSummary, index: number): string {
  const lines: string[] = [];
  lines.push(`### Attempt ${index + 1} (${attempt.file})`);
  lines.push(`Stop reason: ${attempt.stopReason ?? 'unknown'}`);

  if (attempt.costTurns) {
    const parts: string[] = [];
    if (attempt.costTurns.numTurns !== null) parts.push(`${attempt.costTurns.numTurns} turns`);
    if (attempt.costTurns.costUsd !== null) parts.push(`$${attempt.costTurns.costUsd.toFixed(2)}`);
    if (parts.length > 0) lines.push(`Cost/Turns: ${parts.join(' | ')}`);
  }

  lines.push('');
  lines.push('Phases:');
  for (const p of attempt.phases) {
    const dur = p.durationMs !== null ? ` (${Math.round(p.durationMs / 1000)}s)` : '';
    lines.push(`  - ${p.phase}${dur}`);
  }

  if (attempt.roles.length > 0) {
    lines.push('');
    lines.push('Role Commentary:');
    for (const r of attempt.roles) {
      const phase = r.phase ? ` [${r.phase}]` : '';
      lines.push(`  - [${r.role}]${phase}: ${r.commentary}`);
    }
  }

  return lines.join('\n');
}

const TASK_COACHING_SYSTEM = `You are a development coaching assistant analyzing the execution of a specific task in a ralph-managed project. Ralph is a stateless, PRD-driven development methodology automated by AI coding agents.

Analyze the provided execution data and give contextual, specific coaching feedback. Focus on:
1. What went well and what could improve (specific to this task's execution)
2. Role observation — which roles provided substantive input, which were superficial or just skipping
3. Task definition quality — was the description sufficient? Were acceptance criteria clear? Would hints have helped?
4. Concrete suggested changes for future similar tasks

Be specific and actionable. Reference actual data from the execution. Do not give generic boilerplate advice.
Analyze DONE tasks based on their actual execution — do not flag missing conventions that may not have existed when the task was created.`;

const PROJECT_COACHING_SYSTEM = `You are a development coaching assistant analyzing patterns across a ralph-managed project. Ralph is a stateless, PRD-driven development methodology automated by AI coding agents.

Analyze the provided project-wide data and give contextual, specific coaching feedback. Focus on:
1. Patterns across tasks — which milestones have high retry rates, which complexity tiers seem miscategorized
2. Role effectiveness — which roles consistently add value vs. which always skip
3. Project evolution — account for the fact that conventions may have been introduced mid-project; don't flag old tasks for missing conventions that didn't exist when they were created
4. Concrete suggested improvements for task definitions, role configuration, and process

Be specific and reference actual data. Do not give generic boilerplate advice.`;

export async function buildTaskCoachingPrompt(
  taskId: string,
  projectDir: string,
): Promise<CoachingPrompt> {
  const tasksDir = join(projectDir, 'docs', 'tasks');
  const logsDir = join(projectDir, '.ralph-logs');

  let taskContent: string;
  try {
    taskContent = await readFile(join(tasksDir, `${taskId}.md`), 'utf-8');
  } catch {
    taskContent = `(Task file not found for ${taskId})`;
  }

  const logFiles = await findTaskLogs(taskId, logsDir);
  const attempts: AttemptSummary[] = [];
  for (const file of logFiles) {
    attempts.push(await parseAttempt(join(logsDir, file), file));
  }

  const sections: string[] = [];
  sections.push(`# Task: ${taskId}`);
  sections.push('');
  sections.push('## Task File Content');
  sections.push('```markdown');
  sections.push(taskContent);
  sections.push('```');
  sections.push('');

  if (attempts.length === 0) {
    sections.push('## Execution Data');
    sections.push('No log files found for this task.');
  } else {
    sections.push(
      `## Execution Data (${attempts.length} attempt${attempts.length > 1 ? 's' : ''})`,
    );
    sections.push('');
    for (let i = 0; i < attempts.length; i++) {
      sections.push(formatAttemptForPrompt(attempts[i], i));
      sections.push('');
    }
  }

  return {
    systemPrompt: TASK_COACHING_SYSTEM,
    userPrompt: sections.join('\n'),
  };
}

export async function buildProjectCoachingPrompt(projectDir: string): Promise<CoachingPrompt> {
  const tasksDir = join(projectDir, 'docs', 'tasks');
  const logsDir = join(projectDir, '.ralph-logs');

  let tasks: Task[];
  try {
    tasks = await scanTasks(tasksDir);
  } catch {
    tasks = [];
  }

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const totalCount = tasks.length;

  // Gather log summaries per task
  let logFiles: string[];
  try {
    const entries = await readdir(logsDir);
    logFiles = entries.filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    logFiles = [];
  }

  const taskLogMap = new Map<string, AttemptSummary[]>();
  for (const file of logFiles) {
    const match = file.match(/^(T-\d+)-/);
    if (!match) continue;
    const tid = match[1];
    const attempt = await parseAttempt(join(logsDir, file), file);
    const existing = taskLogMap.get(tid) ?? [];
    existing.push(attempt);
    taskLogMap.set(tid, existing);
  }

  // Count retries
  const tasksWithRetries: Array<{ id: string; attempts: number }> = [];
  for (const [tid, attempts] of taskLogMap) {
    if (attempts.length > 1) {
      tasksWithRetries.push({ id: tid, attempts: attempts.length });
    }
  }

  // Role summaries
  const roleSummaries = new Map<string, { total: number; skips: number }>();
  for (const [, attempts] of taskLogMap) {
    const lastAttempt = attempts[attempts.length - 1];
    for (const role of lastAttempt.roles) {
      const entry = roleSummaries.get(role.role) ?? { total: 0, skips: 0 };
      entry.total++;
      if (/\bskipping\b/i.test(role.commentary)) entry.skips++;
      roleSummaries.set(role.role, entry);
    }
  }

  // Complexity distribution
  const complexityMap = new Map<string, number>();
  for (const task of tasks) {
    const tier = task.complexity ?? 'standard';
    complexityMap.set(tier, (complexityMap.get(tier) ?? 0) + 1);
  }

  // Build prompt
  const sections: string[] = [];
  sections.push('# Project Overview');
  sections.push('');
  sections.push(`Total tasks: ${totalCount} (DONE: ${doneCount}, TODO: ${todoCount})`);
  sections.push('');

  sections.push('## Complexity Distribution');
  for (const [tier, count] of complexityMap) {
    sections.push(`  - ${tier}: ${count}`);
  }
  sections.push('');

  if (tasksWithRetries.length > 0) {
    sections.push('## Tasks with retry history');
    for (const t of tasksWithRetries) {
      sections.push(`  - ${t.id}: ${t.attempts} attempts`);
    }
    sections.push('');
  }

  if (roleSummaries.size > 0) {
    sections.push('## Role Commentary Summary');
    for (const [role, stats] of roleSummaries) {
      const skipPct = stats.total > 0 ? Math.round((stats.skips / stats.total) * 100) : 0;
      sections.push(`  - ${role}: ${stats.total} appearances, ${stats.skips} skips (${skipPct}%)`);
    }
    sections.push('');
  }

  // Per-task summaries for tasks with logs
  if (taskLogMap.size > 0) {
    sections.push('## Per-Task Log Summaries');
    for (const [tid, attempts] of taskLogMap) {
      const lastAttempt = attempts[attempts.length - 1];
      sections.push(`### ${tid} (${attempts.length} attempt${attempts.length > 1 ? 's' : ''})`);
      sections.push(`Stop reason: ${lastAttempt.stopReason ?? 'unknown'}`);
      if (
        lastAttempt.costTurns?.numTurns !== null &&
        lastAttempt.costTurns?.numTurns !== undefined
      ) {
        sections.push(`Turns: ${lastAttempt.costTurns.numTurns}`);
      }
      if (lastAttempt.roles.length > 0) {
        sections.push('Roles:');
        for (const r of lastAttempt.roles) {
          sections.push(`  - [${r.role}]: ${r.commentary}`);
        }
      }
      sections.push('');
    }
  }

  return {
    systemPrompt: PROJECT_COACHING_SYSTEM,
    userPrompt: sections.join('\n'),
  };
}

export async function runCoaching(
  taskId: string | undefined,
  projectDir: string,
  options: CoachingOptions,
): Promise<CoachingResult> {
  const timestamp = new Date().toISOString();

  try {
    let prompt: CoachingPrompt;
    if (taskId) {
      prompt = await buildTaskCoachingPrompt(taskId, projectDir);
    } else {
      prompt = await buildProjectCoachingPrompt(projectDir);
    }

    const analysis = await options.spawnAgent({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
    });

    return {
      mode: taskId ? 'task' : 'project',
      taskId,
      analysis,
      timestamp,
    };
  } catch (err) {
    return {
      mode: taskId ? 'task' : 'project',
      taskId,
      analysis: '',
      error: err instanceof Error ? err.message : String(err),
      timestamp,
    };
  }
}

export function formatCoachingOutput(result: CoachingResult): string {
  const lines: string[] = [];

  if (result.error) {
    lines.push('Coaching error: ' + result.error);
    return lines.join('\n');
  }

  if (result.mode === 'task') {
    lines.push(`Coaching Analysis: ${result.taskId}`);
    lines.push('═'.repeat(40));
  } else {
    lines.push('Project Coaching Analysis');
    lines.push('═'.repeat(40));
  }
  lines.push('');
  lines.push(result.analysis);

  return lines.join('\n');
}

export function formatCoachingJson(result: CoachingResult): string {
  const output: Record<string, unknown> = {
    mode: result.mode,
    analysis: result.analysis,
    timestamp: result.timestamp,
  };

  if (result.taskId !== undefined) {
    output.taskId = result.taskId;
  }

  if (result.error !== undefined) {
    output.error = result.error;
  }

  return JSON.stringify(output, null, 2);
}
