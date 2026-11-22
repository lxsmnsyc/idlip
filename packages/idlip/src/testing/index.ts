/**
 * `idlip/testing`: `mount` renders a `.tsx` source on the server, resumes it in the
 * DOM of the test (happy-dom or any global `document`), and serves chunks from memory. A
 * test clicks and types as a user does and waits until chunks and patches settle.
 */
import { compile } from '../compiler/index.ts';
import { getChunkId } from '../core/format.ts';
import type {
  Boot,
  CompileResult,
  Model,
  Patch,
  Props,
  RenderContext,
  ServerModule,
} from '../core/format.ts';
import { patchList } from '../client/list/index.ts';
import { renderListener } from '../client/loader/listener.ts';
import { resume } from '../client/loader/resume.ts';
import { restartSub } from '../client/subs/index.ts';
import * as clientExports from '../client/patch/index.ts';
import { renderPage } from '../server/render.ts';
import * as serverExports from '../server/index.ts';
import { compareTrees } from './compare.ts';
import { bindImports, toDataUrl } from './modules.ts';
import type { Scope } from './modules.ts';

export interface MountOptions {
  /**
   * After each settled step, renders the view on the server from the new model and fails when
   * the patched DOM differs. A mismatch is a stale binding, for example from a helper with a
   * hidden dependency. Default `true`.
   */
  check?: boolean;
  /** The Vite id of the module, which names its chunks. Default `/src/app.tsx`. */
  id?: string;
  /** Written on the state script. */
  nonce?: string;
  /**
   * Lets a `<Try>` catch errors. By default `settled` rethrows an error that a region caught
   * (the `idlip:error` event of a binding that threw), so a test does not pass over a swapped
   * region by mistake. Set it to `true` in a test that expects the catch view. Default `false`.
   */
  expectCaught?: boolean;
}

export interface MountedPage {
  /** The element that holds the page. */
  readonly root: HTMLElement;
  /** The first element that matches a selector. Throws when none does. */
  get: (selector: string) => HTMLElement;
  /** The text content of the first element that matches a selector. */
  text: (selector: string) => string;
  /** Clicks an element. */
  click: (selector: string) => void;
  /** Types a value into a field and fires `input`. */
  input: (selector: string, value: string) => void;
  /**
   * Waits until chunk loads and patches have settled. Throws the first error the loader
   * reported, or that a `<Try>` caught unless `expectCaught` is set. With `check`, then compares
   * the page with a server render of the current model and throws on a difference.
   */
  settled: () => Promise<void>;
  /** The names of the chunks evaluated so far, in order: `handler=toggle`. */
  loaded: () => string[];
  /** Removes the listeners and the page. Later events load nothing. */
  stop: () => void;
}

const STATE_SCRIPT = /<script i-state[^>]*>[\s\S]*<\/script>$/;
const STATE_BODY = /^<script i-state[^>]*>([\s\S]*)<\/script>$/;

let mounts = 0;

/** The page that is mounted now. Two pages would share `$idlip` and the loader's state. */
let live = false;

async function importCode(code: string): Promise<unknown> {
  return import(/* @vite-ignore */ toDataUrl(code));
}

/** Records the listeners added to the window and the document, so one call removes them. */
function recordListeners(): { stop: () => void; release: () => void } {
  const added: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];
  const originals = new Map<EventTarget, typeof window.addEventListener>();
  for (const target of [window, document]) {
    // oxlint-disable-next-line typescript/unbound-method
    const original = target.addEventListener;
    originals.set(target, original);
    target.addEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean,
    ): void => {
      if (listener === null) {
        return;
      }
      added.push([target, type, listener, options]);
      original.call(target, type, listener, options);
    };
  }
  return {
    // Back to the plain `addEventListener`.
    release() {
      for (const [target, original] of originals) {
        target.addEventListener = original;
      }
    },
    stop() {
      for (const [target, type, listener, options] of added) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        target.removeEventListener(type, listener, options as AddEventListenerOptions | boolean);
      }
    },
  };
}

/** Runs a script as the page would, since happy-dom does not run the scripts it parses. */
function runScript(script: string): void {
  // oxlint-disable-next-line no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call
  new Function(script)();
}

/**
 * Compiles a `.tsx` source, renders it on the server with `props`, and resumes it in
 * the document. The document must exist already: use the `happy-dom` test environment.
 */
export async function mount(
  source: string,
  props: Record<string, unknown>,
  options: MountOptions = {},
): Promise<MountedPage> {
  const { check = true, id = '/src/app.tsx', nonce, expectCaught = false } = options;
  const key = `$idlipTesting${mounts++}`;
  const compiled = compile(source, id);
  const messages: string[] = [];
  for (const item of compiled.diagnostics) {
    if (item.severity === 'error') {
      messages.push(item.message);
    }
  }
  if (messages.length > 0) {
    throw new Error(`The source does not compile: ${messages.join('; ')}`);
  }
  if (live) {
    throw new Error('A page is already mounted. Stop the previous page first');
  }
  live = true;
  try {
    return await start(compiled, key, props, check, nonce, expectCaught);
  } catch (error) {
    live = false;
    Reflect.deleteProperty(globalThis, key);
    throw error;
  }
}

async function start(
  compiled: CompileResult,
  key: string,
  props: Record<string, unknown>,
  check: boolean,
  nonce: string | undefined,
  expectCaught: boolean,
): Promise<MountedPage> {
  // Chunks and the server module read the runtime through one object, instead of a bare import.
  const names: string[] = [];
  const scope: Scope = {
    server: { ...serverExports },
    client: { ...clientExports, patchList, restartSub },
    loaded(chunk) {
      names.push(chunk);
    },
  };
  Reflect.set(globalThis, key, scope);

  // 1. Render on the server.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const server = (await importCode(bindImports(compiled.server, key))) as ServerModule;
  // `render` passes the context itself.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const rendered = await renderPage(server.default as (props: Props) => unknown, props, { nonce });
  const { body: html } = rendered;
  // The elements of a `<Head>` go in the document head, which `stop` clears again.
  const headRoot = document.createElement('div');
  headRoot.innerHTML = rendered.head;
  const headElements = [...headRoot.children];
  document.head.append(...headElements);
  const markup = html.replace(STATE_SCRIPT, '');
  const stateScript = STATE_BODY.exec(html.slice(markup.length))?.[1] ?? '';

  // 2. Put the markup and the state script in the document, behind the early listener.
  const root = document.createElement('div');
  root.innerHTML = `${markup}<script i-state></script>`;
  document.body.append(root);
  const boot: Boot = [];
  Reflect.set(globalThis, '$idlip', boot);
  const listeners = recordListeners();
  try {
    runScript(/<script[^>]*>([\s\S]*)<\/script>/.exec(renderListener({ nonce }))?.[1] ?? '');
    runScript(stateScript);
  } finally {
    listeners.release();
  }

  // 3. Serve the chunks from memory: the record's chunk ids map to data URLs.
  const urls = new Map<string, string>();
  for (const chunk of compiled.client) {
    const body = `${bindImports(chunk.code, key)}\n;globalThis[${JSON.stringify(key)}].loaded(${JSON.stringify(chunk.chunk)});\n`;
    urls.set(getChunkId(compiled.manifest.module, chunk.chunk), toDataUrl(body));
  }
  for (const record of boot) {
    const decode = record[1];
    Reflect.set(record, 1, () => {
      const decoded = decode();
      const chunks: Record<string, string> = { ...decoded.chunks };
      for (const chunkId of Object.keys(chunks)) {
        chunks[chunkId] = urls.get(chunkId) ?? chunks[chunkId];
      }
      return { ...decoded, chunks };
    });
  }

  // 4. Start the loader with a patcher that records the models it patched.
  const patcher = clientExports.createPatch(patchList);
  let patched: Model | undefined;
  let checked = true;
  // Errors the loader reported since the last `settled`.
  const failures: unknown[] = [];
  const patch: Patch = async (page, prev, next) => {
    await patcher(page, prev, next);
    patched = next;
    checked = false;
  };
  const loader = resume(boot, patch, (error) => {
    failures.push(error);
  });
  // A region that caught a binding error fires the event and does not report it.
  function recordCaught(event: Event): void {
    const error: unknown =
      event instanceof CustomEvent ? Reflect.get(Object(event.detail), 'error') : undefined;
    if (!failures.includes(error)) {
      failures.push(error);
    }
  }
  if (!expectCaught) {
    document.addEventListener('idlip:error', recordCaught);
  }
  let stopped = false;

  function getElement(selector: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(selector);
    if (element === null) {
      throw new Error(`No element matches ${selector}`);
    }
    return element;
  }

  function checkPage(): void {
    if (!check || patched === undefined || checked) {
      return;
    }
    checked = true;
    // The server module renders from the model it is given instead of from props.
    const fresh = document.createElement('div');
    const context: RenderContext = { state() {}, headId: () => 0, head() {} };
    fresh.innerHTML = server.default(props, context, patched);
    const difference = compareTrees(root, fresh, (node) => node instanceof HTMLScriptElement);
    if (difference !== undefined) {
      throw new Error(`The patched page differs from a server render of its model. ${difference}`);
    }
  }

  return {
    root,
    get: getElement,
    text: (selector) => getElement(selector).textContent,
    click(selector) {
      getElement(selector).click();
    },
    input(selector, value) {
      const element = getElement(selector);
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        throw new TypeError(`${selector} is not a field`);
      }
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    },
    async settled() {
      await loader.settled();
      if (failures.length > 0) {
        // Rejects with the first error. Later ones are dropped.
        const [cause] = failures.splice(0);
        throw cause instanceof Error ? cause : new Error('The page failed', { cause });
      }
      checkPage();
    },
    loaded: () => [...names],
    stop() {
      if (!stopped) {
        stopped = true;
        loader.stop();
        document.removeEventListener('idlip:error', recordCaught);
        listeners.stop();
        root.remove();
        for (const element of document.head.querySelectorAll('[i-head]')) {
          element.remove();
        }
        Reflect.deleteProperty(globalThis, key);
        Reflect.deleteProperty(globalThis, '$idlip');
        live = false;
      }
    },
  };
}
