import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTaskFile(opts: {
  id: string;
  title: string;
  status?: string;
  description?: string;
  prdRef?: string;
  depends?: string;
  touches?: string;
  complexity?: string;
  ac?: boolean;
}): string {
  const lines: string[] = [];
  lines.push(`# ${opts.id}: ${opts.title}`);
  lines.push('');
  lines.push(`- **Status:** ${opts.status ?? 'TODO'}`);
  lines.push(`- **PRD Reference:** ${opts.prdRef ?? '§3.1'}`);
  if (opts.depends) lines.push(`- **Depends:** ${opts.depends}`);
  if (opts.touches) lines.push(`- **Touches:** ${opts.touches}`);
  if (opts.complexity) lines.push(`- **Complexity:** ${opts.complexity}`);
  lines.push('');
  lines.push('## Description');
  lines.push('');
  lines.push(opts.description ?? 'A task description.');
  lines.push('');
  if (opts.ac !== false) {
    lines.push('## AC');
    lines.push('');
    lines.push('- Acceptance criteria item');
    lines.push('');
  }
  return lines.join('\n');
}

function makeLogFile(opts: {
  phases?: string[];
  roles?: Array<{ role: string; phase: string; commentary: string }>;
  numTurns?: number;
  stopReason?: string;
  costUsd?: number;
}): string {
  const lines: string[] = [];
  for (const phase of opts.phases ?? ['Boot', 'Red', 'Green', 'Verify', 'Commit']) {
    lines.push(
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-03-19T10:00:00Z',
        message: { content: [{ type: 'text', text: `[PHASE] Entering: ${phase}` }] },
      }),
    );
  }
  for (const role of opts.roles ?? []) {
    lines.push(
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-03-19T10:01:00Z',
        message: {
          content: [
            {
              type: 'text',
              text: `[PHASE] Entering: ${role.phase}\n[ROLE: ${role.role}] ${role.commentary}`,
            },
          ],
        },
      }),
    );
  }
  const resultObj: Record<string, unknown> = {
    type: 'result',
    num_turns: opts.numTurns ?? 30,
    stop_reason: opts.stopReason ?? 'end_turn',
  };
  if (opts.costUsd !== undefined) {
    resultObj.cost_usd = opts.costUsd;
  }
  lines.push(JSON.stringify(resultObj));
  return lines.join('\n');
}

describe('AI-powered coach module', () => {
  let tmpDir: string;
  let tasksDir: string;
  let logsDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ralph-coach-'));
    tasksDir = join(tmpDir, 'docs', 'tasks');
    logsDir = join(tmpDir, '.ralph-logs');
    await mkdir(tasksDir, { recursive: true });
    await mkdir(logsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('buildTaskCoachingPrompt', () => {
    it('includes the task file content in the prompt', async () => {
      const { buildTaskCoachingPrompt } = await import('../core/coach.js');
      const taskContent = makeTaskFile({
        id: 'T-042',
        title: 'Test task',
        status: 'DONE',
        description: 'Implement the widget parser.',
      });
      await writeFile(join(tasksDir, 'T-042.md'), taskContent);

      const prompt = await buildTaskCoachingPrompt('T-042', tmpDir);
      expect(prompt.userPrompt).toContain('T-042');
      expect(prompt.userPrompt).toContain('widget parser');
    });

    it('includes role commentary from log files', async () => {
      const { buildTaskCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );
      await writeFile(
        join(logsDir, 'T-042-1711036800000.jsonl'),
        makeLogFile({
          roles: [
            { role: 'Product Manager', phase: 'Boot', commentary: 'Task aligns with PRD §3.1.' },
            {
              role: 'SDET',
              phase: 'Verify',
              commentary: 'TDD compliance verified — tests written first.',
            },
          ],
        }),
      );

      const prompt = await buildTaskCoachingPrompt('T-042', tmpDir);
      expect(prompt.userPrompt).toContain('Product Manager');
      expect(prompt.userPrompt).toContain('SDET');
      expect(prompt.userPrompt).toContain('TDD compliance');
    });

    it('includes retry history when multiple attempts exist', async () => {
      const { buildTaskCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );
      await writeFile(
        join(logsDir, 'T-042-1711033200000.jsonl'),
        makeLogFile({ stopReason: 'max_turns', numTurns: 50 }),
      );
      await writeFile(
        join(logsDir, 'T-042-1711036800000.jsonl'),
        makeLogFile({ stopReason: 'end_turn', numTurns: 25 }),
      );

      const prompt = await buildTaskCoachingPrompt('T-042', tmpDir);
      expect(prompt.userPrompt).toContain('Attempt 1');
      expect(prompt.userPrompt).toContain('Attempt 2');
      expect(prompt.userPrompt).toContain('max_turns');
    });

    it('includes phase timeline data', async () => {
      const { buildTaskCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );
      await writeFile(
        join(logsDir, 'T-042-1711036800000.jsonl'),
        makeLogFile({ phases: ['Boot', 'Red', 'Green', 'Verify', 'Commit'] }),
      );

      const prompt = await buildTaskCoachingPrompt('T-042', tmpDir);
      expect(prompt.userPrompt).toContain('Boot');
      expect(prompt.userPrompt).toContain('Verify');
      expect(prompt.userPrompt).toContain('Commit');
    });

    it('has a system prompt that instructs coaching analysis', async () => {
      const { buildTaskCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );

      const prompt = await buildTaskCoachingPrompt('T-042', tmpDir);
      expect(prompt.systemPrompt).toContain('coach');
    });

    it('handles task with no log files', async () => {
      const { buildTaskCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'TODO' }),
      );

      const prompt = await buildTaskCoachingPrompt('T-042', tmpDir);
      expect(prompt.userPrompt).toContain('T-042');
      expect(prompt.userPrompt).toContain('No log files');
    });
  });

  describe('buildProjectCoachingPrompt', () => {
    it('includes aggregated task status counts', async () => {
      const { buildProjectCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-001.md'),
        makeTaskFile({ id: 'T-001', title: 'Done task', status: 'DONE' }),
      );
      await writeFile(
        join(tasksDir, 'T-002.md'),
        makeTaskFile({ id: 'T-002', title: 'Todo task', status: 'TODO' }),
      );

      const prompt = await buildProjectCoachingPrompt(tmpDir);
      expect(prompt.userPrompt).toContain('DONE');
      expect(prompt.userPrompt).toContain('TODO');
    });

    it('includes role commentary summaries across tasks', async () => {
      const { buildProjectCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-001.md'),
        makeTaskFile({ id: 'T-001', title: 'Task 1', status: 'DONE' }),
      );
      await writeFile(
        join(logsDir, 'T-001-1711036800000.jsonl'),
        makeLogFile({
          roles: [
            {
              role: 'DBA / Data Engineer',
              phase: 'Boot',
              commentary: 'Skipping — no data models.',
            },
          ],
        }),
      );

      const prompt = await buildProjectCoachingPrompt(tmpDir);
      expect(prompt.userPrompt).toContain('DBA');
      expect(prompt.userPrompt).toContain('Skipping');
    });

    it('includes retry pattern data', async () => {
      const { buildProjectCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-001.md'),
        makeTaskFile({ id: 'T-001', title: 'Task 1', status: 'DONE' }),
      );
      await writeFile(
        join(logsDir, 'T-001-1711033200000.jsonl'),
        makeLogFile({ stopReason: 'max_turns' }),
      );
      await writeFile(
        join(logsDir, 'T-001-1711036800000.jsonl'),
        makeLogFile({ stopReason: 'end_turn' }),
      );

      const prompt = await buildProjectCoachingPrompt(tmpDir);
      expect(prompt.userPrompt).toContain('retry');
    });

    it('has a system prompt for project-wide analysis', async () => {
      const { buildProjectCoachingPrompt } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-001.md'),
        makeTaskFile({ id: 'T-001', title: 'Task 1', status: 'DONE' }),
      );

      const prompt = await buildProjectCoachingPrompt(tmpDir);
      expect(prompt.systemPrompt).toContain('coach');
      expect(prompt.systemPrompt).toContain('project');
    });

    it('handles empty project gracefully', async () => {
      const { buildProjectCoachingPrompt } = await import('../core/coach.js');
      const prompt = await buildProjectCoachingPrompt(tmpDir);
      expect(prompt.userPrompt).toContain('0');
    });
  });

  describe('runCoaching (AI-powered)', () => {
    it('invokes the agent provider with the coaching prompt', async () => {
      const { runCoaching } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );
      await writeFile(
        join(logsDir, 'T-042-1711036800000.jsonl'),
        makeLogFile({ stopReason: 'end_turn' }),
      );

      const result = await runCoaching('T-042', tmpDir, {
        agent: 'mock',
        spawnAgent: async () => 'AI coaching analysis: Task T-042 executed well.',
      });

      expect(result.analysis).toContain('T-042');
      expect(result.taskId).toBe('T-042');
      expect(result.mode).toBe('task');
    });

    it('runs project-wide coaching when no task ID is provided', async () => {
      const { runCoaching } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-001.md'),
        makeTaskFile({ id: 'T-001', title: 'Task 1', status: 'DONE' }),
      );

      const result = await runCoaching(undefined, tmpDir, {
        agent: 'mock',
        spawnAgent: async () => 'Project-wide analysis: good progress.',
      });

      expect(result.mode).toBe('project');
      expect(result.analysis).toContain('good progress');
      expect(result.taskId).toBeUndefined();
    });

    it('passes system prompt and user prompt to the spawn function', async () => {
      const { runCoaching } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );

      let capturedSystem = '';
      let capturedUser = '';
      await runCoaching('T-042', tmpDir, {
        agent: 'mock',
        spawnAgent: async (opts) => {
          capturedSystem = opts.systemPrompt;
          capturedUser = opts.userPrompt;
          return 'Analysis result';
        },
      });

      expect(capturedSystem).toContain('coach');
      expect(capturedUser).toContain('T-042');
    });

    it('returns error analysis when agent spawn fails', async () => {
      const { runCoaching } = await import('../core/coach.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );

      const result = await runCoaching('T-042', tmpDir, {
        agent: 'mock',
        spawnAgent: async () => {
          throw new Error('Agent connection failed');
        },
      });

      expect(result.error).toContain('Agent connection failed');
    });
  });

  describe('formatCoachingOutput', () => {
    it('formats task-specific coaching as readable text', async () => {
      const { formatCoachingOutput } = await import('../core/coach.js');
      const output = formatCoachingOutput({
        mode: 'task',
        taskId: 'T-042',
        analysis: 'The task executed efficiently with good role participation.',
        timestamp: '2026-03-19T10:00:00Z',
      });

      expect(output).toContain('T-042');
      expect(output).toContain('efficiently');
    });

    it('formats project-wide coaching as readable text', async () => {
      const { formatCoachingOutput } = await import('../core/coach.js');
      const output = formatCoachingOutput({
        mode: 'project',
        analysis: 'The project shows strong progress across milestones.',
        timestamp: '2026-03-19T10:00:00Z',
      });

      expect(output).toContain('strong progress');
    });

    it('formats error results', async () => {
      const { formatCoachingOutput } = await import('../core/coach.js');
      const output = formatCoachingOutput({
        mode: 'task',
        taskId: 'T-042',
        analysis: '',
        error: 'Agent connection failed',
        timestamp: '2026-03-19T10:00:00Z',
      });

      expect(output).toContain('error');
    });
  });

  describe('formatCoachingJson', () => {
    it('returns structured JSON with analysis and metadata for task coaching', async () => {
      const { formatCoachingJson } = await import('../core/coach.js');
      const result = formatCoachingJson({
        mode: 'task',
        taskId: 'T-042',
        analysis: 'Good execution.',
        timestamp: '2026-03-19T10:00:00Z',
      });

      const parsed = JSON.parse(result);
      expect(parsed.taskId).toBe('T-042');
      expect(parsed.mode).toBe('task');
      expect(parsed.analysis).toBe('Good execution.');
      expect(parsed.timestamp).toBe('2026-03-19T10:00:00Z');
    });

    it('returns structured JSON for project-wide coaching', async () => {
      const { formatCoachingJson } = await import('../core/coach.js');
      const result = formatCoachingJson({
        mode: 'project',
        analysis: 'Project analysis.',
        timestamp: '2026-03-19T10:00:00Z',
      });

      const parsed = JSON.parse(result);
      expect(parsed.mode).toBe('project');
      expect(parsed.analysis).toBe('Project analysis.');
      expect(parsed.taskId).toBeUndefined();
    });

    it('includes error field when present', async () => {
      const { formatCoachingJson } = await import('../core/coach.js');
      const result = formatCoachingJson({
        mode: 'task',
        taskId: 'T-042',
        analysis: '',
        error: 'Failed',
        timestamp: '2026-03-19T10:00:00Z',
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Failed');
    });
  });

  describe('review --coach routing', () => {
    it('routes --coach with task ID to task-specific coaching', async () => {
      const review = await import('../commands/review.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );
      await writeFile(
        join(logsDir, 'T-042-1711036800000.jsonl'),
        makeLogFile({ stopReason: 'end_turn' }),
      );

      const logs: string[] = [];
      const origLog = console.log;
      const origError = console.error;
      console.log = (msg: string) => logs.push(msg);
      console.error = (msg: string) => logs.push(msg);
      try {
        await review.run(['T-042', '--coach'], tmpDir, {
          agent: 'mock',
          spawnAgent: async () => 'Task-specific analysis for T-042.',
        });
        const output = logs.join('\n');
        expect(output).toContain('T-042');
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    });

    it('routes --coach without task ID to project-wide coaching', async () => {
      const review = await import('../commands/review.js');
      await writeFile(
        join(tasksDir, 'T-001.md'),
        makeTaskFile({ id: 'T-001', title: 'Task 1', status: 'DONE' }),
      );

      const logs: string[] = [];
      const origLog = console.log;
      const origError = console.error;
      console.log = (msg: string) => logs.push(msg);
      console.error = (msg: string) => logs.push(msg);
      try {
        await review.run(['--coach'], tmpDir, {
          agent: 'mock',
          spawnAgent: async () => 'Project-wide coaching analysis.',
        });
        const output = logs.join('\n');
        expect(output).toContain('Project-wide');
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    });

    it('outputs JSON with --coach --json for task-specific coaching', async () => {
      const review = await import('../commands/review.js');
      await writeFile(
        join(tasksDir, 'T-042.md'),
        makeTaskFile({ id: 'T-042', title: 'Test', status: 'DONE' }),
      );

      const logs: string[] = [];
      const origLog = console.log;
      const origError = console.error;
      console.log = (msg: string) => logs.push(msg);
      console.error = (msg: string) => logs.push(msg);
      try {
        await review.run(['T-042', '--coach', '--json'], tmpDir, {
          agent: 'mock',
          spawnAgent: async () => 'JSON task analysis.',
        });
        const parsed = JSON.parse(logs.join(''));
        expect(parsed.taskId).toBe('T-042');
        expect(parsed.mode).toBe('task');
        expect(parsed.analysis).toContain('JSON task analysis');
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    });

    it('outputs JSON with --coach --json for project-wide coaching', async () => {
      const review = await import('../commands/review.js');
      await writeFile(
        join(tasksDir, 'T-001.md'),
        makeTaskFile({ id: 'T-001', title: 'Task 1', status: 'DONE' }),
      );

      const logs: string[] = [];
      const origLog = console.log;
      const origError = console.error;
      console.log = (msg: string) => logs.push(msg);
      console.error = (msg: string) => logs.push(msg);
      try {
        await review.run(['--coach', '--json'], tmpDir, {
          agent: 'mock',
          spawnAgent: async () => 'JSON project analysis.',
        });
        const parsed = JSON.parse(logs.join(''));
        expect(parsed.mode).toBe('project');
        expect(parsed.analysis).toContain('JSON project analysis');
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    });
  });
});
