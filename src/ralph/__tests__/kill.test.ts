import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as processModule from '../core/process.js';
import * as pidFileModule from '../core/pid-file.js';

vi.mock('../core/process.js', () => ({
  killProcessTree: vi.fn(),
}));

vi.mock('../core/pid-file.js', () => ({
  readPidFile: vi.fn(),
  removePidFile: vi.fn(),
}));

const killProcessTree = vi.mocked(processModule.killProcessTree);
const readPidFile = vi.mocked(pidFileModule.readPidFile);
const removePidFile = vi.mocked(pidFileModule.removePidFile);

async function loadKill() {
  const mod = await import('../commands/kill.js');
  return mod.run;
}

describe('ralph kill', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reports "Ralph is not running" when no PID file exists', async () => {
    readPidFile.mockResolvedValue(null);
    const run = await loadKill();
    await run([], '/fake/project');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not running'));
  });

  it('reads the PID file from .ralph-logs/ralph.pid', async () => {
    readPidFile.mockResolvedValue(null);
    const run = await loadKill();
    await run([], '/fake/project');
    expect(readPidFile).toHaveBeenCalledWith('/fake/project/.ralph-logs/ralph.pid');
  });

  it('kills the process tree and removes the PID file', async () => {
    readPidFile.mockResolvedValue(1234);
    killProcessTree.mockResolvedValue(undefined);
    removePidFile.mockResolvedValue(undefined);

    const run = await loadKill();
    await run([], '/fake/project');

    expect(killProcessTree).toHaveBeenCalledWith(1234);
    expect(removePidFile).toHaveBeenCalledWith('/fake/project/.ralph-logs/ralph.pid');
    expect(logSpy).toHaveBeenCalledWith('Killed 1 process');
  });

  it('reports errors when kill fails', async () => {
    readPidFile.mockResolvedValue(1234);
    killProcessTree.mockRejectedValueOnce(new Error('EPERM'));

    const run = await loadKill();
    await run([], '/fake/project');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('1234'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('EPERM'));
  });

  it('handles non-Error throws gracefully', async () => {
    readPidFile.mockResolvedValue(999);
    killProcessTree.mockRejectedValueOnce('string error');

    const run = await loadKill();
    await run([], '/fake/project');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });
});
