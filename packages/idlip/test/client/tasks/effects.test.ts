// @vitest-environment happy-dom
// oxlint-disable typescript/no-unsafe-type-assertion, no-new-func
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { renderListener } from '../../../src/client/loader/listener.ts';
import { resume } from '../../../src/client/loader/resume.ts';
import { getChunkFile } from '../../../src/core/format.ts';
import type { Boot, Patch } from '../../../src/core/format.ts';

const CHUNKS = join(import.meta.dirname, '../../../node_modules/.idlip-loader-test');
const EXPECTED = join(import.meta.dirname, '../../fixtures/effects/expected');

// The functions the fixture's task chunks import from `./api.ts`.
const API = `
export function makeId() { return Promise.resolve('id-1'); }
export function saveTodos(todos) { (globalThis.idlipSaved ??= []).push(todos); return Promise.resolve(); }
export function loadLabel(prefix, count) { return Promise.resolve(prefix + '/' + count); }
`;

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

// Waits for the state itself, since a chunk import takes as long as the machine allows.
async function until(done: () => boolean): Promise<void> {
  while (!done()) {
    await new Promise((resolve) => {
      setTimeout(resolve, 2);
    });
  }
}

it('runs the compiled effects chunks: props reach a continuation and awaits chain', async () => {
  const scope = globalThis as unknown as { $idlip?: Boot; idlipSaved?: unknown[] };
  mkdirSync(CHUNKS, { recursive: true });
  const dir = mkdtempSync(join(CHUNKS, 'effects-'));
  writeFileSync(join(dir, 'api.mjs'), API);
  const [markup, state] = readFileSync(join(EXPECTED, 'page.html'), 'utf8').split(
    '<script i-state>',
  ) as [string, string];
  // Each chunk id points at a copy of the compiled file, next to an `api.mjs` stub for `./api.ts`.
  const script = state
    .replace('</script>', '')
    .replaceAll(
      /("[^"]*\.tsx\?idlip-([^&"]+)&lang\.js"):"[^"]*"/g,
      (_all, key: string, chunk: string) => {
        const name = getChunkFile(chunk);
        writeFileSync(
          join(dir, `${name}.mjs`),
          readFileSync(join(EXPECTED, 'client', name), 'utf8').replace('./api.ts', './api.mjs'),
        );
        return `${key}:${JSON.stringify(`/@fs${join(dir, `${name}.mjs`)}`)}`;
      },
    );
  document.body.innerHTML = `${markup}<script i-state></script>`;
  scope.$idlip = [];
  scope.idlipSaved = [];
  // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-implied-eval
  new Function(renderListener({}).replace(/^<script[^>]*>|<\/script>$/g, ''))();
  // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-implied-eval
  new Function(script)();
  const patch = vi.fn<Patch>(async () => {});
  const errors: unknown[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const resumed = resume(scope.$idlip, patch, (error) => {
    errors.push(error);
  });
  cleanup = () => {
    resumed.stop();
    spy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
    document.body.innerHTML = '';
  };

  const [, save, rename] = [...document.querySelectorAll('button')];

  // `persist` carries `props$step` (1) into its continuation: saved goes from 0 to 1.
  function lastLabel(): unknown {
    return (patch.mock.calls.at(-1)?.[2] as { label?: unknown } | undefined)?.label;
  }
  save.click();
  await until(() => lastLabel() === 'done' || errors.length > 0);
  await resumed.settled();
  expect(errors).toEqual([]);
  expect(scope.idlipSaved).toEqual([[]]);
  expect(patch.mock.calls.at(-1)![2]).toMatchObject({ saved: 1, label: 'done' });
  expect(patch.mock.calls.at(-1)![2]).toMatchObject({ save: { state: 'idle' } });

  // `rename` awaits twice and carries a local between the awaits.
  rename.click();
  await until(() => lastLabel() === 'todo/0:todo/0/0:0' || errors.length > 0);
  await resumed.settled();
  expect(patch.mock.calls.at(-1)![2]).toMatchObject({ label: 'todo/0:todo/0/0:0' });
  expect(errors).toEqual([]);
});
