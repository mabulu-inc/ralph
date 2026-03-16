import type { InitConfig } from './claude-md.js';

export interface RalphConfigJson {
  language: string;
  packageManager: string;
  testingFramework: string;
  qualityCheck: string;
  testCommand: string;
  agent: string;
  model?: string;
  fileNaming?: string;
  database?: string;
  maxRetries?: number;
  maxCostPerTask?: number;
  maxLoopBudget?: number;
}

export function generateRalphConfigJson(
  config: InitConfig,
  agent: string,
  model?: string,
  maxRetries?: number,
  maxCostPerTask?: number,
  maxLoopBudget?: number,
): string {
  const obj: RalphConfigJson = {
    language: config.language,
    packageManager: config.packageManager,
    testingFramework: config.testingFramework,
    qualityCheck: config.qualityCheck,
    testCommand: config.testCommand,
    agent,
  };

  if (model) {
    obj.model = model;
  }

  if (config.fileNaming) {
    obj.fileNaming = config.fileNaming;
  }

  if (config.database) {
    obj.database = config.database;
  }

  if (maxRetries !== undefined && maxRetries !== 3) {
    obj.maxRetries = maxRetries;
  }

  if (maxCostPerTask !== undefined && maxCostPerTask !== 10) {
    obj.maxCostPerTask = maxCostPerTask;
  }

  if (maxLoopBudget !== undefined && maxLoopBudget !== 100) {
    obj.maxLoopBudget = maxLoopBudget;
  }

  return JSON.stringify(obj, null, 2) + '\n';
}
