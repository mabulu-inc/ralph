import type { Task } from './tasks.js';

export type ComplexityTier = 'light' | 'standard' | 'heavy';

const INTEGRATION_KEYWORDS = /\b(integration|end-to-end|e2e|refactor)\b/i;

export function computeTaskComplexity(task: Task): ComplexityTier {
  const depCount = task.depends.length;
  const produces = task.producesCount;
  const hasKeyword =
    INTEGRATION_KEYWORDS.test(task.title) || INTEGRATION_KEYWORDS.test(task.description);

  if (hasKeyword || depCount >= 4 || produces >= 5) {
    return 'heavy';
  }

  if (depCount >= 2 || produces >= 3) {
    return 'standard';
  }

  return 'light';
}
