// oxlint-disable import/prefer-default-export
import { DEV, warnDeepQueue } from '../../core/dev.ts';
import { getChunkId } from '../../core/format.ts';
import { runAfter } from '../dom/run.ts';
import { HAS_REFS, HAS_TASKS } from '../features.ts';
import { runTask } from '../tasks/run.ts';
import type {
  After,
  Boot,
  HandlerChunk,
  Model,
  Page,
  PageState,
  Patch,
  QueuedEvent,
  Step,
  Update,
} from '../../core/format.ts';

interface Root {
  readonly script: Element;
  readonly page: Page;
  readonly state: PageState;
  /** The model after the last update. */
  model: Model;
  /** The model the DOM shows. It changes only after a patch succeeds. */
  rendered: Model;
  /** Dom calls to run after the patch of the batch. */
  after?: After[];
}

interface Pending {
  readonly event: QueuedEvent;
  readonly root: Root;
  update: Update | undefined;
  /** The chunk failed to load. The item waits for the next event with its tag. */
  failed: boolean;
}

/** An error that loading again would not change: an unknown tag, or a chunk without its export. */
class DropError extends Error {}

function logError(error: unknown): void {
  // oxlint-disable-next-line no-console
  console.error(error);
}

// oxlint-disable-next-line typescript/promise-function-async
function importChunk(url: string): Promise<unknown> {
  // The import stays alone in its function, so the build keeps the comment. Without it Vite
  // wraps the import in its preload helper, which puts the loader over its budget.
  return import(/* @vite-ignore */ url);
}

function isStep(result: Model | Step): result is Step {
  return '$step' in result;
}

export interface Resumed {
  /** Hands the queue back to a plain array and drops the events that wait. */
  readonly stop: () => void;
  /**
   * Resolves when no chunk is loading, no batch runs and no event waits for a chunk. Events
   * behind a failed chunk stay queued and do not hold it.
   */
  readonly settled: () => Promise<void>;
}

/**
 * Takes over the listener's queue and runs each event through its handler chunk. Events
 * wait while chunks load, run through `update` in order, and the page patches once per
 * batch. A state record is decoded when its first event arrives. `onError` also gets each error that
 * the loader reports. It returns `stop` and `settled`.
 */
export function resume(boot: Boot, patch: Patch, onError?: (error: unknown) => void): Resumed {
  function report(error: unknown): void {
    logError(error);
    onError?.(error);
  }

  const queue: Pending[] = [];
  const roots = new Map<number, Root>();
  const loads = new Map<string, Promise<unknown>>();
  const failures = new Map<string, number>();
  let running = false;
  let stopped = false;
  /** Wake-ups for `settled`, called when a flush ends. */
  const idle: (() => void)[] = [];

  if (!Object.hasOwn(boot, 'push')) {
    // oxlint-disable-next-line no-console
    console.warn('idlip: renderListener() is missing');
  }

  async function load(url: string): Promise<unknown> {
    let promise = loads.get(url);
    if (promise === undefined) {
      // A browser may keep a failed import, so a retry asks for the URL with a fragment.
      const retry = failures.get(url);
      promise = importChunk(retry === undefined ? url : `${url}#${retry}`);
      loads.set(url, promise);
      // A failed load is forgotten, so the next event tries again.
      promise.catch(() => {
        loads.delete(url);
        failures.set(url, (retry ?? 0) + 1);
      });
    }
    return promise;
  }

  function isInside(script: Element, target: Element): boolean {
    const parent = script.parentNode;
    return (
      parent !== null &&
      parent.contains(target) &&
      (script === target ||
        (script.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING) !== 0)
    );
  }

  function createRoot(script: Element, record: Boot[number]): Root {
    const state = record[1]();
    return {
      script,
      model: state.model,
      rendered: state.model,
      state,
      page: {
        root: script.parentNode ?? document,
        manifest: state.manifest,
        props: state.props,
        load: async (module, chunk) => load(state.chunks[getChunkId(module, chunk)]),
      },
    };
  }

  function findRoot(target: Element): Root | undefined {
    for (const root of roots.values()) {
      if (isInside(root.script, target)) {
        return root;
      }
    }
    // A state script follows its markup, and its record is at its position in the page.
    const scripts = document.querySelectorAll('script[i-state]');
    for (let index = 0; index < scripts.length; index++) {
      const record = boot.at(index);
      if (record !== undefined && isInside(scripts[index], target)) {
        const root = createRoot(scripts[index], record);
        roots.set(index, root);
        return root;
      }
    }
    return undefined;
  }

  function enqueue(event: QueuedEvent): void {
    let root: Root | undefined;
    try {
      root = findRoot(event.target);
    } catch (error) {
      report(error);
    }
    if (root === undefined) {
      report(new Error(`idlip: no state for ${event.message.t}`));
      return;
    }
    // An event for a tag whose chunk failed asks for another try.
    for (const other of queue) {
      if (other.failed && other.root === root && other.event.message.t === event.message.t) {
        other.failed = false;
      }
    }
    const item: Pending = { event, root, update: undefined, failed: false };
    if (event.latest) {
      // Latest wins: the pending event of this element and type is replaced.
      for (let index = 0; index < queue.length; index++) {
        const other = queue[index].event;
        if (other.latest && other.target === event.target && other.type === event.type) {
          queue[index] = item;
          return;
        }
      }
    }
    if (DEV) {
      warnDeepQueue(queue, event);
    }
    queue.push(item);
  }

  async function getUpdate(root: Root, tag: string): Promise<Update> {
    const { manifest, chunks } = root.state;
    const entry = Object.hasOwn(manifest.handlers, tag) ? manifest.handlers[tag] : undefined;
    const url = entry === undefined ? undefined : chunks[getChunkId(manifest.module, entry.chunk)];
    if (url === undefined) {
      throw new DropError(`idlip: no chunk for ${tag}`);
    }
    // The binding chunks start with the handler chunk, not after it. A failure surfaces in the patch.
    for (const key of entry?.bindings ?? []) {
      load(chunks[getChunkId(manifest.module, manifest.groups[key].chunk)]).catch(() => {});
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const module = (await load(url)) as HandlerChunk;
    if (!Object.hasOwn(module, tag) || typeof module[tag] !== 'function') {
      throw new DropError(`idlip: no export ${tag}`);
    }
    return module[tag];
  }

  async function loadUpdate(item: Pending): Promise<void> {
    item.update = await getUpdate(item.root, item.event.message.t);
  }

  // Loads the chunks of the waiting events. An event that cannot run is dropped, and an event
  // whose chunk failed to load stays in the queue for the next try.
  async function loadWaiting(): Promise<void> {
    const waiting: Pending[] = [];
    const loading: Promise<void>[] = [];
    for (const item of queue) {
      if (item.update === undefined && !item.failed) {
        waiting.push(item);
        loading.push(loadUpdate(item));
      }
    }
    const results = await Promise.allSettled(loading);
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === 'rejected') {
        report(result.reason);
        if (result.reason instanceof DropError) {
          queue.splice(queue.indexOf(waiting[index]), 1);
        } else {
          waiting[index].failed = true;
        }
      }
    }
  }

  // Takes the events whose chunks are loaded, in order.
  function takeReady(): Pending[] {
    const ready: Pending[] = [];
    const rest: Pending[] = [];
    // A root's events stay in order: the ones after a failed event wait behind it.
    const blocked = new Set<Root>();
    for (const item of queue) {
      if (item.update === undefined || blocked.has(item.root)) {
        blocked.add(item.root);
        rest.push(item);
      } else {
        ready.push(item);
      }
    }
    queue.splice(0, queue.length, ...rest);
    return ready;
  }

  function hasWaiting(): boolean {
    for (const item of queue) {
      if (item.update === undefined && !item.failed) {
        return true;
      }
    }
    return false;
  }

  // Runs one message. A built-in task settles here, so its continuation joins the batch. Any
  // other task runs on its own, and its continuation joins the queue when it settles.
  async function apply(root: Root, update: Update, message: QueuedEvent['message']): Promise<void> {
    const result = update(root.model, message.p);
    if (!((HAS_TASKS || HAS_REFS) && isStep(result))) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      root.model = result as Model;
      return;
    }
    root.model = result.model;
    if (HAS_REFS && result.after !== undefined) {
      (root.after ??= []).push(...result.after);
    }
    if (!HAS_TASKS || result.task === undefined) {
      return;
    }
    await runTask(
      {
        page: root.page,
        apply: async (next, sent) => apply(root, next, sent),
        // The state script stands for the target, since a continuation has no element.
        push: (sent) => {
          boot.q!.push({ message: sent, target: root.script, type: '', latest: false });
        },
        report,
      },
      result.task,
    );
  }

  async function runBatch(batch: readonly Pending[]): Promise<void> {
    const touched = new Set<Root>();
    for (const { event, root, update } of batch) {
      touched.add(root);
      try {
        await apply(root, update!, event.message);
      } catch (error) {
        report(error);
      }
    }
    for (const root of touched) {
      if (stopped) {
        return;
      }
      let patched = true;
      if (root.model !== root.rendered) {
        try {
          await patch(root.page, root.rendered, root.model);
          root.rendered = root.model;
        } catch (error) {
          patched = false;
          report(error);
        }
      }
      if (HAS_REFS) {
        const calls = root.after?.splice(0);
        if (patched && calls !== undefined) {
          runAfter(root.page, calls);
        }
      }
    }
  }

  async function flush(): Promise<void> {
    if (running) {
      return;
    }
    running = true;
    try {
      for (;;) {
        // Events that arrive while chunks load join the wait, so a burst patches once.
        while (hasWaiting()) {
          await loadWaiting();
        }
        const ready = takeReady();
        if (stopped || ready.length === 0) {
          break;
        }
        await runBatch(ready);
      }
    } catch (error) {
      report(error);
    } finally {
      running = false;
      for (const wake of idle.splice(0)) {
        wake();
      }
    }
  }

  async function settled(): Promise<void> {
    for (;;) {
      if (!running && !hasWaiting()) {
        return;
      }
      await new Promise<void>((resolve) => {
        idle.push(resolve);
      });
    }
  }

  boot.q ??= [];
  const events = boot.q;
  const early = events.splice(0);
  events.push = (...next: QueuedEvent[]): number => {
    for (const event of next) {
      enqueue(event);
    }
    flush().catch(report);
    return queue.length;
  };
  for (const event of early) {
    enqueue(event);
  }
  flush().catch(report);

  function stop(): void {
    stopped = true;
    queue.length = 0;
    Reflect.deleteProperty(events, 'push');
  }

  return { stop, settled };
}
