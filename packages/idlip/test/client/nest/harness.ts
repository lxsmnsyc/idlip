// oxlint-disable no-new-func, typescript/no-unsafe-call, typescript/no-implied-eval, typescript/no-unsafe-type-assertion
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { resume } from '../../../src/client/loader/resume.ts';
import { addBlock, createPatch } from '../../../src/client/patch/index.ts';
import { patchList } from '../../../src/client/list/index.ts';
import { getChunkFile } from '../../../src/core/format.ts';
import type { Boot } from '../../../src/core/format.ts';
import { installListener } from '../loader/helpers.ts';

const FIXTURES = join(import.meta.dirname, '../../fixtures/nested');
const CHUNKS = join(import.meta.dirname, '.chunks');
const NESTING = join(import.meta.dirname, '../../../src/client/nesting.ts');

const scope = globalThis as unknown as { idlipNestLoaded?: string[] };

/** The chunks that were evaluated, as `module:chunk`. */
export function getLoaded(): string[] {
  return (scope.idlipNestLoaded ??= []);
}

/** Handlers that the board fixture lacks, to change the props of its children. */
const EXTRA: Readonly<Record<string, string>> = {
  relabel:
    'export function relabel(model, [id, label]) { return { ...model, items: model.items.map((i) => (i.id === id ? { ...i, label } : i)) }; }',
  add: 'export function add(model, [id, label]) { return { ...model, items: [...model.items, { id, label }] }; }',
  reverse:
    'export function reverse(model) { return { ...model, items: model.items.toReversed() }; }',
};

export interface Harness {
  /** Queues a message for the root, as an event on its state script. */
  send: (tag: string, payload: unknown[]) => void;
  readonly boot: Boot;
  readonly errors: unknown[];
  /** Resolves when no chunk is loading and no batch runs. */
  settled: () => Promise<void>;
  cleanup: () => void;
}

/**
 * Renders `nested/board` into the page and points its chunks at copies that record their
 * loading. The copies import `addChild` and `setProp` from `nesting.ts`, since `idlip/client`
 * would boot a second loader. The copies sit outside node_modules, so Vite runs them and they
 * share the module of the loader. The real loader and patcher run on the page.
 */
export function setup(): Harness {
  mkdirSync(CHUNKS, { recursive: true });
  const dir = mkdtempSync(join(CHUNKS, 'run-'));
  const [markup, state] = readFileSync(join(FIXTURES, 'board/expected/page.html'), 'utf8').split(
    '<script i-state>',
  ) as [string, string];
  const urls = new Map<string, string>();

  function urlOf(id: string): string {
    let url = urls.get(id);
    if (url === undefined) {
      const [, module, chunk] = /^(.*)\?idlip-([^&]+)&lang\.js$/.exec(id)!;
      const name = module.split('/').pop()!.split('.')[0];
      url = `/@fs${join(dir, `${name}.${getChunkFile(chunk)}.mjs`)}`;
      urls.set(id, url);
      const source = readFileSync(
        join(FIXTURES, name, 'expected/client', getChunkFile(chunk)),
        'utf8',
      );
      const code = source
        .replaceAll("'idlip/client'", JSON.stringify(`/@fs${NESTING}`))
        .replaceAll(/'(\/src\/[^']+\?idlip-[^']+&lang\.js)'/g, (_all, other: string) =>
          JSON.stringify(urlOf(other)),
        );
      const mark = `\n(globalThis.idlipNestLoaded ??= []).push(${JSON.stringify(`${name}:${chunk}`)});\n`;
      writeFileSync(url.slice(4), code + mark);
    }
    return url;
  }

  let extra = '';
  let handlers = '';
  for (const [tag, code] of Object.entries(EXTRA)) {
    const file = join(dir, `extra.${tag}.mjs`);
    writeFileSync(file, code);
    const id = `/src/board.tsx?idlip-handler=${tag}&lang.js`;
    extra += `${JSON.stringify(id)}:${JSON.stringify(`/@fs${file}`)},`;
    handlers += `${tag}:{chunk:"handler=${tag}"},`;
  }
  const script = state
    .replace('</script>', '')

    .replaceAll(
      /("[^"]*\.tsx\?idlip-[^&"]+&lang\.js"):"[^"]*"/g,
      (_all, key: string) => `${key}:${JSON.stringify(urlOf(JSON.parse(key) as string))}`,
    );
  const full = script
    .replace('handlers:{', `handlers:{${handlers}`)
    .replace('chunks:{', `chunks:{${extra}`);
  document.body.innerHTML = `${markup}<script i-state></script>`;
  // The node index belongs to the old page, and `document.body` is the root of every test.
  addBlock(document.createComment('x'));
  getLoaded().length = 0;
  const listener = installListener();
  new Function(full)();
  const errors: unknown[] = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { stop, settled } = resume(listener.boot, createPatch(patchList), (error) => {
    errors.push(error);
  });
  return {
    send(tag, payload) {
      listener.boot.q!.push({
        message: { t: tag, p: payload },
        target: document.querySelector('script[i-state]')!,
        type: '',
        latest: false,
      });
    },
    boot: listener.boot,
    errors,
    settled,
    cleanup() {
      stop();
      listener.cleanup();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
