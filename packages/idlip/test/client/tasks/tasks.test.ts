// @vitest-environment happy-dom
// oxlint-disable typescript/no-unsafe-type-assertion, no-new-func
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderListener } from '../../../src/client/loader/listener.ts';
import { resume } from '../../../src/client/loader/resume.ts';
import { getChunkFile, getChunkId } from '../../../src/core/format.ts';
import type { Boot, Patch } from '../../../src/core/format.ts';

const CHUNKS = join(import.meta.dirname, '../../../node_modules/.idlip-loader-test');
const MODULE = '/m.idlip.tsx';

interface Globals {
  $idlip?: Boot;
  taskCalls?: unknown[][];
  taskGates?: ((outcome: { ok: boolean; value: unknown }) => void)[];
}

const scope = globalThis as unknown as Globals;

// Hand-written chunks in the shape of the task-chunk change request.
const SOURCES: Record<string, string> = {
  'handler=go': `
export function go(model) {
  return { model: { ...model, busy: true }, task: { site: 'go$1', args: [], then: 'go$1', carried: [] } };
}
export function go$1(model, [outcome]) {
  return { ...model, id: outcome.ok ? outcome.value : 'failed' };
}
function rid() { return 'id-1'; }
export { rid as 'task$go$1' };
export function slow(model, [n]) {
  return { model: { ...model, wait: true }, task: { site: 'slow$1', args: [n], then: 'slow$1', carried: ['tag'] } };
}
export function slow$1(model, [outcome, tag]) {
  return { ...model, last: [outcome.ok, outcome.ok ? outcome.value : String(outcome.error), tag] };
}
`,
  'task=slow$1': `
export function run(n) {
  (globalThis.taskCalls ??= []).push([n]);
  return new Promise((resolve) => {
    (globalThis.taskGates ??= []).push(resolve);
  });
}
`,
};

interface Run {
  patch: ReturnType<typeof vi.fn<Patch>>;
  errors: unknown[];
  click: (tag: string, payload?: unknown[]) => void;
  cleanup: () => void;
}

function start(sources: Record<string, string> = SOURCES): Run {
  mkdirSync(CHUNKS, { recursive: true });
  const dir = mkdtempSync(join(CHUNKS, 'tasks-'));
  const chunks: Record<string, string> = {};
  for (const [chunk, source] of Object.entries(sources)) {
    const file = join(dir, `${getChunkFile(chunk)}.mjs`);
    writeFileSync(file, source);
    chunks[getChunkId(MODULE, chunk)] = `/@fs${file}`;
  }
  const manifest = {
    module: MODULE,
    events: ['click'],
    handlers: {
      go: { chunk: 'handler=go' },
      go$1: { chunk: 'handler=go' },
      slow: { chunk: 'handler=go' },
      slow$1: { chunk: 'handler=go' },
    },
    groups: {},
    lists: {},
    tasks: { go$1: 'handler=go', slow$1: 'task=slow$1' },
  };
  const state = { manifest, chunks, model: { n: 0 }, props: {} };
  document.body.innerHTML = `<div><button id="go" on:click='["go",[]]'>go</button><button id="slow" on:click='["slow",[1]]'>slow</button></div><script i-state></script>`;
  scope.taskCalls = [];
  scope.taskGates = [];
  scope.$idlip = [];
  // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-implied-eval
  new Function(renderListener({}).replace(/^<script[^>]*>|<\/script>$/g, ''))();
  scope.$idlip.push(['click', () => state] as never);
  const patch = vi.fn<Patch>(async () => {});
  const errors: unknown[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const resumed = resume(scope.$idlip, patch, (error) => {
    errors.push(error);
  });
  return {
    patch,
    errors,
    click(tag) {
      document.querySelector<HTMLElement>(`#${tag}`)!.click();
    },
    cleanup() {
      resumed.stop();
      spy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
      document.body.innerHTML = '';
    },
  };
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 8; tick++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}

let run: Run | undefined;

afterEach(() => {
  run?.cleanup();
  run = undefined;
});

describe('built-in task', () => {
  it('runs the continuation before the patch and patches once', async () => {
    run = start();
    run.click('go');
    await settle();
    expect(run.patch).toHaveBeenCalledTimes(1);
    expect(run.patch.mock.calls[0][1]).toEqual({ n: 0 });
    expect(run.patch.mock.calls[0][2]).toEqual({ n: 0, busy: true, id: 'id-1' });
    expect(run.errors).toEqual([]);
  });

  it('gives the continuation a failed outcome when the task throws', async () => {
    run = start({
      'handler=go': SOURCES['handler=go'].replace("return 'id-1';", "throw new Error('no');"),
    });
    run.click('go');
    await settle();
    expect(run.patch.mock.calls[0][2]).toEqual({ n: 0, busy: true, id: 'failed' });
  });
});

describe('built-in without its function', () => {
  it('reports the missing export instead of a failed outcome', async () => {
    run = start({
      'handler=go': SOURCES['handler=go'].replace("export { rid as 'task$go$1' };", ''),
    });
    run.click('go');
    await settle();
    expect(run.errors).toHaveLength(1);
    expect(String(run.errors[0])).toContain('no task for go$1');
  });
});

describe('task with its own chunk', () => {
  it('patches the step without waiting for the task', async () => {
    run = start();
    run.click('slow');
    await settle();
    expect(scope.taskCalls).toEqual([[1]]);
    expect(run.patch).toHaveBeenCalledTimes(1);
    expect(run.patch.mock.calls[0][2]).toEqual({ n: 0, wait: true });
  });

  it('continues with { ok: true, value } and the carried locals', async () => {
    run = start();
    run.click('slow');
    await settle();
    scope.taskGates![0]('v' as never);
    await settle();
    expect(run.patch.mock.calls.at(-1)![2]).toEqual({ n: 0, wait: true, last: [true, 'v', 'tag'] });
  });

  it('continues with { ok: false, error } when the task rejects', async () => {
    run = start({
      ...SOURCES,
      'task=slow$1': 'export function run() { return Promise.reject(new Error("down")); }',
    });
    run.click('slow');
    await settle();
    expect(run.patch.mock.calls.at(-1)![2]).toEqual({
      n: 0,
      wait: true,
      last: [false, 'Error: down', 'tag'],
    });
  });

  it('continues once per click, independently', async () => {
    run = start();
    run.click('slow');
    run.click('slow');
    await settle();
    expect(scope.taskCalls).toEqual([[1], [1]]);
    scope.taskGates![1]('b' as never);
    await settle();
    expect(run.patch.mock.calls.at(-1)![2]).toEqual({ n: 0, wait: true, last: [true, 'b', 'tag'] });
    scope.taskGates![0]('a' as never);
    await settle();
    expect(run.patch.mock.calls.at(-1)![2]).toEqual({ n: 0, wait: true, last: [true, 'a', 'tag'] });
  });

  it('reports a failed task chunk and keeps the model', async () => {
    run = start({
      ...SOURCES,
      'task=slow$1': 'throw new Error("chunk down");',
    });
    run.click('slow');
    await settle();
    expect(run.errors).toHaveLength(1);
    expect(String(run.errors[0])).toContain('chunk down');
    expect(run.patch.mock.calls[0][2]).toEqual({ n: 0, wait: true });
    // The model is the step's model, and later events still run.
    run.click('go');
    await settle();
    expect(run.patch.mock.calls.at(-1)![2]).toEqual({ n: 0, wait: true, busy: true, id: 'id-1' });
  });
});
