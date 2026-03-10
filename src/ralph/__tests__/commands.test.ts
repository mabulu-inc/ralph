import { describe, it, expect, vi } from 'vitest';
import { run as initRun } from '../commands/init.js';
import { run as loopRun } from '../commands/loop.js';

const stubs = [
  { name: 'init', run: initRun },
  { name: 'loop', run: loopRun },
] as const;

describe('command stubs', () => {
  it.each(stubs)('$name exports a run function that logs stub message', async ({ name, run }) => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(name));
    spy.mockRestore();
  });
});
