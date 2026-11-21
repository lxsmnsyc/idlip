// oxlint-disable no-new-func, typescript/no-unsafe-call, typescript/no-implied-eval, typescript/no-unsafe-type-assertion
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { renderListener } from '../../../src/client/loader/listener.ts';
import { resume } from '../../../src/client/loader/resume.ts';
import { getChunkFile } from '../../../src/core/format.ts';
import type { Boot, Patch } from '../../../src/core/format.ts';

const FIXTURES = join(import.meta.dirname, '../../fixtures');
const CHUNKS = join(import.meta.dirname, '../../../node_modules/.idlip-loader-test');

interface TestGlobals {
  idlipLoaded?: string[];
  idlipGates?: Record<string, () => void>;
  idlipBroken?: string[];
  $idlip?: Boot;
}

const scope = globalThis as unknown as TestGlobals;

/** The chunks that were evaluated, in order. Each copy of a fixture chunk records its name. */
export function getLoaded(): string[] {
  return (scope.idlipLoaded ??= []);
}

export interface Options {
  /** Chunk names (`handler=toggle`) that fail to evaluate until `restore`. */
  readonly broken?: readonly string[];
  /** Chunk names whose evaluation waits for `release`. */
  readonly gated?: readonly string[];
  readonly nonce?: string;
}

export interface Harness {
  readonly patch: ReturnType<typeof vi.fn<Patch>>;
  readonly boot: Boot;
  /** Starts the loader, which takes over what the listener queued. */
  start: () => void;
  /** Stops a chunk from failing. */
  restore: (chunk: string) => void;
  cleanup: () => void;
}

function extractScript(html: string): string {
  return /<script[^>]*>([\s\S]*)<\/script>/.exec(html)![1];
}

/**
 * Runs the listener script as a page's `<head>` would, and records the listeners it adds so
 * `cleanup` can remove them.
 */
export interface ListenerCall {
  readonly type: string;
  readonly options: AddEventListenerOptions | boolean | undefined;
}

export function installListener(
  nonce?: string,
  early: Boot = [],
): { boot: Boot; calls: ListenerCall[]; cleanup: () => void } {
  const added: [EventTarget, string, EventListener][] = [];
  const calls: ListenerCall[] = [];
  for (const target of [window, document]) {
    const original = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, opts) => {
      added.push([target, type, listener as EventListener]);
      calls.push({ type, options: opts });
      original(type, listener, opts);
    });
  }
  // Records pushed before the listener ran.
  scope.$idlip = early;
  new Function(extractScript(renderListener({ nonce })))();
  return {
    boot: scope.$idlip,
    calls,
    cleanup() {
      for (const [index, [target, type, listener]] of added.entries()) {
        target.removeEventListener(type, listener, calls[index].options);
      }
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    },
  };
}

/**
 * Renders a fixture page into the document, installs the listener and the state script, and
 * points the chunk URLs at copies of the fixture chunks that record their loading.
 */
export function setup(fixture: string, options: Options = {}): Harness {
  mkdirSync(CHUNKS, { recursive: true });
  const dir = mkdtempSync(join(CHUNKS, 'run-'));
  const expected = join(FIXTURES, fixture, 'expected');
  const [markup, state] = readFileSync(join(expected, 'page.html'), 'utf8').split(
    '<script i-state>',
  ) as [string, string];
  scope.idlipGates = {};
  scope.idlipBroken = [...(options.broken ?? [])];

  function writeChunk(chunk: string): void {
    const source = readFileSync(join(expected, 'client', getChunkFile(chunk)), 'utf8');
    const gate = options.gated?.includes(chunk)
      ? `await new Promise((r) => { globalThis.idlipGates[${JSON.stringify(chunk)}] = r; });\n`
      : '';
    const fail = `if (globalThis.idlipBroken.includes(${JSON.stringify(chunk)})) { throw new Error("chunk failed"); }\n`;
    writeFileSync(
      join(dir, `${getChunkFile(chunk)}.mjs`),
      `${fail}${gate}${source}\n(globalThis.idlipLoaded ??= []).push(${JSON.stringify(chunk)});\n`,
    );
  }

  // The state script maps chunk ids to URLs. Each URL becomes a copy of the fixture file.
  const script = state
    .replace('</script>', '')
    .replaceAll(
      /("[^"]*\.idlip\.tsx\?idlip-([^&"]+)&lang\.js"):"[^"]*"/g,
      (_all, key: string, chunk: string) => {
        writeChunk(chunk);
        return `${key}:${JSON.stringify(`/@fs${join(dir, `${getChunkFile(chunk)}.mjs`)}`)}`;
      },
    );

  // The script's text runs below with the URLs changed, so the DOM only needs the element.
  document.body.innerHTML = `${markup}<script i-state></script>`;
  getLoaded().length = 0;
  const listener = installListener(options.nonce);
  new Function(script)();

  const patch = vi.fn<Patch>(async () => {});
  const boot = listener.boot;
  return {
    patch,
    boot,
    start() {
      resume(boot, patch);
    },
    restore(chunk) {
      const broken = scope.idlipBroken!;
      broken.splice(broken.indexOf(chunk), 1);
    },
    cleanup() {
      listener.cleanup();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function release(chunk: string): void {
  scope.idlipGates![chunk]();
}

/** Lets pending promises and imports settle. */
export async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}
