import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanTasks, type Task } from '../core/tasks.js';

interface MilestoneTask {
  id: string;
  status: string;
  milestone: string;
  title: string;
  cost: string | undefined;
}

function parseCost(cost: string | undefined): number {
  if (!cost) return 0;
  return parseFloat(cost.replace('$', '')) || 0;
}

function formatCost(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function generateMilestones(tasks: MilestoneTask[]): string {
  const milestoneOrder: string[] = [];
  const milestoneGroups = new Map<string, MilestoneTask[]>();

  for (const task of tasks) {
    if (!milestoneGroups.has(task.milestone)) {
      milestoneOrder.push(task.milestone);
      milestoneGroups.set(task.milestone, []);
    }
    milestoneGroups.get(task.milestone)!.push(task);
  }

  const lines: string[] = [
    '# Milestones',
    '',
    '> **Auto-generated** by `ralph milestones` — do not edit manually.',
    '',
  ];
  let grandTotal = 0;

  for (const milestone of milestoneOrder) {
    const group = milestoneGroups.get(milestone)!;
    const milestoneCost = group.reduce((sum, t) => sum + parseCost(t.cost), 0);
    grandTotal += milestoneCost;

    const heading =
      milestoneCost > 0 ? `## ${milestone} (${formatCost(milestoneCost)})` : `## ${milestone}`;
    lines.push(heading);
    lines.push('');

    for (const task of group) {
      const checkbox = task.status === 'DONE' ? '[x]' : '[ ]';
      const costSuffix = task.cost ? ` — ${task.cost}` : '';
      lines.push(`- ${checkbox} ${task.id}: ${task.title}${costSuffix}`);
    }

    lines.push('');
  }

  lines.push(`**Grand Total: ${formatCost(grandTotal)}**`);
  lines.push('');

  return lines.join('\n');
}

export async function run(_args: string[], cwd?: string): Promise<void> {
  const projectDir = cwd ?? process.cwd();
  const tasksDir = join(projectDir, 'docs', 'tasks');
  const tasks = await scanTasks(tasksDir);

  const md = generateMilestones(
    tasks.map((t: Task) => ({
      id: t.id,
      status: t.status,
      milestone: t.milestone,
      title: t.title,
      cost: t.cost,
    })),
  );

  const outPath = join(projectDir, 'docs', 'MILESTONES.md');
  await writeFile(outPath, md);
  console.log(`Wrote ${outPath}`);
}
