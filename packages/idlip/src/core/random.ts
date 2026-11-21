// oxlint-disable import/prefer-default-export, typescript/require-await
async function id(): Promise<string> {
  return crypto.randomUUID();
}

async function number(): Promise<number> {
  return Math.random();
}

/**
 * Random values, awaited in handlers so the message log records them.
 */
export const Random: { id(): Promise<string>; number(): Promise<number> } = { id, number };
