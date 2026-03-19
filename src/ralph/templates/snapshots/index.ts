import { defaultBootPromptTemplate } from '../boot-prompt.js';
import { defaultSystemPromptTemplate } from '../system-prompt.js';
import { generateMethodology } from '../methodology.js';
import { generatePromptsReadme } from '../prompts-readme.js';

export interface TemplateSnapshot {
  type: string;
  version: string;
  content: string;
}

const CURRENT_VERSION = '0.6.2';

const registry: TemplateSnapshot[] = [];

export function getSnapshotsForType(type: string): TemplateSnapshot[] {
  return registry.filter((s) => s.type === type);
}

export function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const aLines = a.split('\n');
  const bLines = b.split('\n');

  if (aLines.length === 0 || bLines.length === 0) return 0;

  const aSet = new Set(aLines.map((l) => l.trim()));
  const bSet = new Set(bLines.map((l) => l.trim()));

  let intersection = 0;
  for (const line of aSet) {
    if (bSet.has(line)) {
      intersection++;
    }
  }

  const union = new Set([...aSet, ...bSet]).size;
  if (union === 0) return 1;

  return intersection / union;
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}

export function registerSnapshot(snapshot: TemplateSnapshot): void {
  registry.push(snapshot);
}

export function clearSnapshots(): void {
  registry.length = 0;
}

export function getAllSnapshots(): TemplateSnapshot[] {
  return [...registry];
}

export function initializeCurrentSnapshots(): void {
  const currentSnapshots: Array<{ type: string; content: string }> = [
    { type: 'system-prompt', content: defaultSystemPromptTemplate() },
    { type: 'boot-prompt', content: defaultBootPromptTemplate() },
    { type: 'methodology', content: generateMethodology() },
    { type: 'prompts-readme', content: generatePromptsReadme() },
  ];

  for (const snap of currentSnapshots) {
    registerSnapshot({
      type: snap.type,
      version: CURRENT_VERSION,
      content: snap.content,
    });
  }
}
