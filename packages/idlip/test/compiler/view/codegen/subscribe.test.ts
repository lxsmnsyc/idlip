import { expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';
import { listChunks } from '../../../../src/vite/chunks.ts';
import { getDefines, getFeatures } from '../../../../src/vite/features.ts';

const SOURCE = `
import { Subscribe, timer } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

async function* every(ms: number, signal: AbortSignal) {
  yield* timer(ms, signal);
}

export default function Clock(): JSX.Element {
  let room = 'a';
  let ticks = 0;
  function tick(now: number) {
    ticks = ticks + 1;
  }
  return (
    <main>
      <p>{ticks}</p>
      <Subscribe to={every} input={1000} on:value={tick} />
      <Subscribe key={room} to={timer} input={room} on:value={tick} />
    </main>
  );
}
`;

function find(name: string, chunks: readonly { chunk: string; code: string }[]): string {
  const found = chunks.find((item) => item.chunk === name);
  if (found === undefined) {
    throw new Error(`no chunk ${name}`);
  }
  return found.code;
}

it('emits a marker block, a source chunk per source and a restart binding', () => {
  const result = compile(SOURCE, '/src/clock.tsx');
  expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
  expect(result.manifest.sources).toEqual(['every', 'timer']);
  expect(listChunks(result.manifest)).toContain('source=every');

  // Each marker is its own block, so the block hooks reach it.
  expect(result.server).toMatch(
    /<!--c\d+:s--><template i-sub="every"\$\{attr\$\('i-input', JSON\.stringify\(1000\)\)\} on:value="\$e0"><\/template><!--\/c-->/,
  );
  expect(result.server).toContain("attr$('i-key', JSON.stringify(room))");
  // `on:value` is read by the loader, so no listener is needed for it.
  expect(result.manifest.events).toEqual([]);

  const every = find('source=every', result.client);
  expect(every).toContain('async function* every');
  expect(every).toContain("import { timer } from 'idlip';");
  expect(every).toContain('export { every as source };');
  expect(find('source=timer', result.client)).toContain('export { timer as source };');

  // The key reads `room`, so a binding restarts the run when it changes.
  const binding = find('binding=room', result.client);
  expect(binding).toContain("import { restartSub } from 'idlip/client';");
  expect(binding).toContain(
    'restartSub(el, JSON.stringify(model.room), JSON.stringify(model.room));',
  );
});

it('turns the loader flag on only for a view with a source', () => {
  const withSource = compile(SOURCE, '/src/clock.tsx');
  const without = compile(
    'export default function App() { let n = 0; function inc() { n = n + 1; } return <button on:click={inc}>{n}</button>; }',
    '/src/app.tsx',
  );
  expect(getDefines(getFeatures([withSource])).get('__IDLIP_HAS_SUBS__')).toBe('true');
  expect(getDefines(getFeatures([without])).get('__IDLIP_HAS_SUBS__')).toBe('false');
  expect(without.manifest.sources).toBeUndefined();
});
