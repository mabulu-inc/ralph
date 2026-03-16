import { open } from 'node:fs/promises';

export interface SessionResult {
  subtype: string;
  numTurns: number | undefined;
  stopReason: string | undefined;
}

/**
 * Parse the last `type: "result"` entry from a JSONL log file.
 * Reads the file line-by-line and keeps the last result found.
 */
export async function parseSessionResult(logFile: string): Promise<SessionResult | undefined> {
  let handle;
  try {
    handle = await open(logFile, 'r');
  } catch {
    return undefined;
  }

  let lastResult: SessionResult | undefined;

  try {
    for await (const line of handle.readLines()) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'result') {
          lastResult = {
            subtype: entry.subtype,
            numTurns: entry.num_turns ?? undefined,
            stopReason: entry.stop_reason ?? undefined,
          };
        }
      } catch {
        // Skip malformed lines
      }
    }
  } finally {
    await handle.close();
  }

  return lastResult;
}
