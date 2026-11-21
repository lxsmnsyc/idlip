// Dev only. The loader reaches this module through `import.meta.hot`, so the production build
// drops it. The plugin sends one `idlip:hot` message per edited module (`src/vite/hot.ts`).
import type { Boot, Model } from '../core/format.ts';
import type { Child, Root, Unit } from './loader/resume.ts';

/**
 * What the page does after edits. `idle`: no edit since the page loaded. `swapped`: edited
 * chunks load again, and the page keeps its markup. `remounting`: the markup is being
 * replaced.
 */
export type HotPhase = 'idle' | 'swapped' | 'remounting';

/**
 * The payload of the `idlip:hot` message. `chunks` holds chunk URLs: the changed chunks of a
 * `swap`, every chunk of the module for a `remount`.
 */
export interface HotMessage {
  readonly module: string;
  readonly kind: 'swap' | 'remount';
  readonly chunks: readonly string[];
  readonly timestamp: number;
}

/** The part of `import.meta.hot` that this module uses. */
export interface HotContext {
  on: (event: 'idlip:hot', listener: (message: HotMessage) => void) => void;
}

/** What the hot module needs from the loader. */
export interface HotHost {
  readonly boot: Boot;
  readonly roots: Map<number, Root>;
  readonly createRoot: (script: Element, record: Boot[number]) => Root;
  /** Patches the DOM of a component from `rendered` to `model`. */
  readonly patch: (unit: Unit) => Promise<void>;
  /** The live children of a root. Absent when the build has no children. */
  readonly children?: (root: Root) => readonly Child[];
  /** Stops the runs of `<Subscribe>` blocks, and starts the ones in the page. */
  readonly subs?: { readonly stop: () => void; readonly start: () => void };
  readonly settled: () => Promise<void>;
  readonly report: (error: unknown) => void;
}

export interface Hot {
  /** Returns the URL to import for a chunk URL: the stamped one once the chunk changed. */
  readonly rewrite: (url: string) => string;
  readonly phase: () => HotPhase;
}

/**
 * Keeps the values of the old model for the fields that the new model still has. A field that
 * an edit added starts at its new initial value, and a field that it dropped goes away.
 */
export function mergeModel(initial: Model, current: Model): Model {
  const merged: Record<string, unknown> = { ...initial };
  for (const key of Object.keys(initial)) {
    if (Object.hasOwn(current, key)) {
      merged[key] = Reflect.get(current, key);
    }
  }
  return merged;
}

function stamp(url: string, timestamp: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${timestamp}`;
}

/**
 * Listens for `idlip:hot`. A swap makes the next load of each changed chunk import a new URL,
 * so the next event runs the new code on the same model. A remount renders the page again on
 * the server, replaces the body, and patches each root from its fresh model to the model it
 * had.
 */
export function connectHot(hot: HotContext, host: HotHost): Hot {
  let phase: HotPhase = 'idle';
  const fresh = new Map<string, string>();
  // Messages run one after another.
  let tail: Promise<void> = Promise.resolve();

  function markChunks(message: HotMessage): void {
    for (const url of message.chunks) {
      fresh.set(url, stamp(url, message.timestamp));
    }
  }

  async function replaceBody(): Promise<void> {
    const response = await fetch(location.href, { headers: { accept: 'text/html' } });
    if (!response.ok) {
      throw new Error(`idlip: the server answered ${response.status} for ${location.href}`);
    }
    const next = new DOMParser().parseFromString(await response.text(), 'text/html');
    host.boot.length = 0;
    host.roots.clear();
    // A new body, since the patcher keeps the nodes it found by root.
    document.body.replaceWith(document.adoptNode(next.body));
    // A script that came from the parser does not run, so each state script is made again.
    for (const old of document.body.querySelectorAll('script[i-state]')) {
      const script = document.createElement('script');
      for (const { name, value } of old.attributes) {
        script.setAttribute(name, value);
      }
      script.textContent = old.textContent;
      old.replaceWith(script);
    }
  }

  async function remount(message: HotMessage): Promise<void> {
    markChunks(message);
    await host.settled();
    // The models of each root, and of the children that live in it by path.
    const models = new Map<number, { model: Model; children: Map<string, Model> }>();
    for (const [index, root] of host.roots) {
      const children = new Map<string, Model>();
      for (const child of host.children?.(root) ?? []) {
        children.set(child.path, child.model);
      }
      models.set(index, { model: root.model, children });
    }
    // The markers of the old page leave with its body.
    host.subs?.stop();
    await replaceBody();
    const scripts = document.body.querySelectorAll('script[i-state]');
    for (const [index, { model: current, children }] of models) {
      const record = host.boot.at(index);
      if (record === undefined) {
        continue;
      }
      const root = host.createRoot(scripts[index], record);
      root.model = mergeModel(root.model, current);
      host.roots.set(index, root);
      // The DOM shows the fresh model, so the patch carries the page to the kept one.
      // oxlint-disable-next-line no-await-in-loop
      await host.patch(root);
      // The patch may add children, so they are listed after it.
      for (const child of host.children?.(root) ?? []) {
        const kept = children.get(child.path);
        if (kept !== undefined) {
          child.model = mergeModel(child.model, kept);
          // oxlint-disable-next-line no-await-in-loop
          await host.patch(child);
        }
      }
    }
    // The markers hold the inputs the patches left.
    host.subs?.start();
  }

  async function handle(message: HotMessage): Promise<void> {
    if (message.kind === 'swap') {
      markChunks(message);
      phase = 'swapped';
      return;
    }
    phase = 'remounting';
    try {
      await remount(message);
    } finally {
      phase = 'swapped';
    }
  }

  hot.on('idlip:hot', (message) => {
    tail = tail.then(async () => handle(message)).catch(host.report);
  });

  return { rewrite: (url) => fresh.get(url) ?? url, phase: () => phase };
}
