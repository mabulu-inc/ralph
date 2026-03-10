#!/usr/bin/env node
import { dispatch, formatHelp } from './cli.js';

async function main(): Promise<void> {
  const result = dispatch(process.argv.slice(2));

  if (result.action === 'help') {
    const text = formatHelp(result.unknown);
    if (result.unknown) {
      console.error(text);
      process.exitCode = 1;
    } else {
      console.log(text);
    }
    return;
  }

  const { run } = await import(`./commands/${result.action}.js`);
  await run(result.args);
}

main();
