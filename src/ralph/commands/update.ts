export interface UpdateResult {
  deprecated: boolean;
  message: string;
}

export async function runUpdate(_rootDir: string): Promise<UpdateResult> {
  return {
    deprecated: true,
    message:
      "ralph update is no longer needed — ralph now reads prompts from built-in code. Run 'ralph migrate' to clean up legacy prompt files.",
  };
}

export async function run(_args: string[]): Promise<void> {
  const result = await runUpdate(process.cwd());
  console.log(result.message);
}
