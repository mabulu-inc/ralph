import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getPricing } from './defaults.js';

interface TokenUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

function parseUsageLine(line: string): TokenUsage | null {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line);
    if (!obj.usage) return null;
    const u = obj.usage;
    return {
      input_tokens: u.input_tokens ?? 0,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
    };
  } catch {
    return null;
  }
}

function computeCost(usages: TokenUsage[]): number {
  const totals: TokenUsage = {
    input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 0,
  };
  for (const u of usages) {
    totals.input_tokens += u.input_tokens;
    totals.cache_creation_input_tokens += u.cache_creation_input_tokens;
    totals.cache_read_input_tokens += u.cache_read_input_tokens;
    totals.output_tokens += u.output_tokens;
  }
  const pricing = getPricing();
  return (
    (totals.input_tokens / 1_000_000) * pricing.input +
    (totals.cache_creation_input_tokens / 1_000_000) * pricing.cacheWrite +
    (totals.cache_read_input_tokens / 1_000_000) * pricing.cacheRead +
    (totals.output_tokens / 1_000_000) * pricing.output
  );
}

export async function calculateLogFileCost(logFile: string): Promise<number> {
  let content: string;
  try {
    content = await readFile(logFile, 'utf-8');
  } catch {
    return 0;
  }
  if (!content.trim()) return 0;

  const usages = content
    .split('\n')
    .map(parseUsageLine)
    .filter((u): u is TokenUsage => u !== null);

  if (usages.length === 0) return 0;
  return computeCost(usages);
}

export async function calculateTaskCost(logsDir: string, taskId: string): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(logsDir);
  } catch {
    return 0;
  }

  const prefix = `${taskId}-`;
  const taskFiles = entries.filter((f) => f.startsWith(prefix) && f.endsWith('.jsonl'));
  if (taskFiles.length === 0) return 0;

  let total = 0;
  for (const file of taskFiles) {
    total += await calculateLogFileCost(join(logsDir, file));
  }
  return total;
}
