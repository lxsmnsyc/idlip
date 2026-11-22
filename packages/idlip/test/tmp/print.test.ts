// Scratch: prints the client chunks of a source file. Not committed.
import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';

it.skipIf(process.env.FILE === undefined)('print', () => {
  const file = process.env.FILE ?? '';
  const result = compile(readFileSync(file, 'utf8'), '/src/app.tsx', {
    children: process.env.CHILDREN === undefined ? undefined : [process.env.CHILDREN],
  });
  const filter = process.env.CHUNK ?? '';
  for (const module of result.client) {
    if (module.chunk.includes(filter)) {
      console.log(`--- ${module.chunk}\n${module.code}`);
    }
  }
  if (process.env.SERVER) {
    console.log(result.server);
  }
  for (const d of result.diagnostics) {
    console.log('DIAG', d.rule, d.message);
  }
});
