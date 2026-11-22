// oxlint-disable import/prefer-default-export
import { DEV, warnDeepQueue } from '../../core/dev.ts';
import { HELPERS_KEY, TEMPLATES_KEY, getChunkId } from '../../core/format.ts';
import { runAfter } from '../dom/run.ts';
import { RESET, fireError, keepModel, resetRegion } from '../errors.ts';
import {
  HAS_CHILDREN,
  HAS_DYNAMIC,
  HAS_ERRORS,
  HAS_HEAD,
  HAS_REFS,
  HAS_RETRY,
  HAS_SKEW,
  HAS_SUBS,
  HAS_TASKS,
} from '../features.ts';
import { checkSkew } from '../skew.ts';
import { startHead } from '../head.ts';
import { connectHot } from '../hot.ts';
import type { Hot } from '../hot.ts';
import { getChildren, installNesting } from '../nesting.ts';
import { startSubs } from '../subs/index.ts';
import type { SubsHost } from '../subs/index.ts';
import { runTask } from '../tasks/run.ts';
import type {
  After,
  Boot,
  HandlerChunk,
  Model,
  Page,
  PageState,
  Patch,
  Props,
  QueuedEvent,
  Step,
  Update,
} from '../../core/format.ts';

interface Component {
  readonly script: Element;
  /** A child replaces it when its props or its boundary change. */
  page: Page;
  readonly state: PageState;
  /** The model after the last update. */
  model: Model;
  /** The model the DOM shows. It changes only after a patch succeeds. */
  rendered: Model;
  /** Dom calls to run after the patch of the batch. */
  after?: After[];
}

/** The component of a state script. */
export interface Root extends Component {
  readonly kind: 'root';
}

/** A stateful child that the page renders, found by its model path. */
export interface Child extends Component {
  readonly kind: 'live';
  /** The model path of the child. */
  readonly path: string;
  /** Counts the times the path was added, so late work for an old slot is told apart. */
  readonly gen: number;
  readonly top: Root;
  /** The props the DOM shows. */
  shown: Props;
}

/** What a message runs on, and what a patch updates. */
export type Unit = Root | Child;

/** What the loader asks of nesting. */
export interface Nesting {
  /** The component an event addresses. `undefined` drops the event. */
  target: (root: Root, event: QueuedEvent) => Unit | undefined;
  /** Tells whether a component still takes messages. */
  live: (unit: Unit) => boolean;
  /** Patches the DOM of a component whose model or props changed. */
  patch: (unit: Unit) => Promise<void>;
}

interface Pending {
  readonly event: QueuedEvent;
  readonly root: Root;
  readonly unit: Unit;
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

  const nest = HAS_CHILDREN ? installNesting(patch) : undefined;

  // Set below, since the loader functions that read it come first.
  // oxlint-disable-next-line prefer-const
  let hot: Hot | undefined;
  let stopHotSubs: (() => void) | undefined;
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
    if (import.meta.hot) {
      // Dev only: a chunk that an edit changed loads from a new URL.
      url = hot!.rewrite(url);
    }
    let promise = loads.get(url);
    if (promise === undefined) {
      // A browser may keep a failed import, so a retry asks for the URL with a fragment.
      const retry = failures.get(url);
      const target = retry === undefined ? url : `${url}#${retry}`;
      // A chunk that fails is asked for once more at once, under another URL.
      promise = HAS_RETRY
        ? importChunk(target).catch(async () => importChunk(`${url}#r${retry ?? 0}`))
        : importChunk(target);
      loads.set(url, promise);
      // A failed load is forgotten, so the next event tries again.
      promise.catch(() => {
        loads.delete(url);
        failures.set(url, (retry ?? 0) + 1);
        // A chunk that is gone may mean a newer build.
        if (HAS_SKEW) {
          checkSkew();
        }
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
      kind: 'root',
      state,
      page: {
        root: script.parentNode ?? document,
        manifest: state.manifest,
        props: state.props,
        load: async (module, chunk) => load(state.chunks[getChunkId(module, chunk)]),
        ...(HAS_DYNAMIC && { dynamic: state.dynamic }),
      },
    };
  }

  // Dev only. `import.meta.hot` is undefined in a build, so this and its import are dropped.
  hot = import.meta.hot
    ? connectHot(import.meta.hot, {
        boot,
        roots,
        createRoot,
        patch: async (root) => {
          if (HAS_CHILDREN) {
            await nest!.patch(root);
          } else {
            await patch(root.page, root.rendered, root.model);
            root.rendered = root.model;
          }
        },
        children: HAS_CHILDREN ? getChildren : undefined,
        subs: HAS_SUBS
          ? {
              stop: () => {
                // oxlint-disable-next-line no-use-before-define
                stopSubs?.();
                stopHotSubs?.();
              },
              start: () => {
                // oxlint-disable-next-line no-use-before-define
                stopHotSubs = startSubs(subsHost);
              },
            }
          : undefined,
        settled: async () => settled(),
        report,
      })
    : undefined;

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
    const unit = HAS_CHILDREN ? nest!.target(root, event) : root;
    if (HAS_CHILDREN && unit === undefined) {
      return;
    }
    const item: Pending = { event, root, unit: unit!, update: undefined, failed: false };
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

  async function getUpdate(root: Unit, tag: string): Promise<Update> {
    const { manifest, chunks } = root.state;
    const entry = Object.hasOwn(manifest.handlers, tag) ? manifest.handlers[tag] : undefined;
    const url = entry === undefined ? undefined : chunks[getChunkId(manifest.module, entry.chunk)];
    if (url === undefined) {
      throw new DropError(`idlip: no chunk for ${tag}`);
    }
    // The binding chunks and the helpers and templates modules they import start with the handler chunk, not
    // after it. A failure surfaces in the patch.
    for (const key of [HELPERS_KEY, TEMPLATES_KEY]) {
      if (Object.hasOwn(chunks, key)) {
        load(chunks[key]).catch(() => {});
      }
    }
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
    // A reset has no handler chunk: it keeps the model and renders a region in `runBatch`.
    item.update =
      HAS_ERRORS && item.event.message.t === RESET
        ? keepModel
        : await getUpdate(item.unit, item.event.message.t);
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
        if (HAS_ERRORS) {
          fireError(result.reason, waiting[index].unit.page.path);
        }
        // A subscription asks for its next value only after this one, so it must not wait.
        if (HAS_SUBS) {
          waiting[index].event.done?.();
        }
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
  async function apply(root: Unit, update: Update, message: QueuedEvent['message']): Promise<void> {
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
          if (!HAS_CHILDREN || nest!.live(root)) {
            boot.q!.push({
              message: sent,
              target: root.script,
              type: '',
              latest: false,
              ...(HAS_CHILDREN && root.kind === 'live' && { owner: root.path }),
            });
          }
        },
        report,
      },
      result.task,
    );
  }

  async function runBatch(batch: readonly Pending[]): Promise<void> {
    const touched = new Set<Unit>();
    for (const { event, unit, update } of batch) {
      if (HAS_CHILDREN && !nest!.live(unit)) {
        // The component left the page while the chunk loaded.
        continue;
      }
      touched.add(unit);
      if (HAS_SUBS && event.signal?.aborted) {
        continue;
      }
      try {
        if (HAS_ERRORS && event.message.t === RESET) {
          await resetRegion(unit.page, unit.model, event.target, event.message.p[0]);
        } else {
          await apply(unit, update!, event.message);
        }
      } catch (error) {
        report(error);
        if (HAS_ERRORS) {
          fireError(error, unit.page.path);
        }
      }
    }
    for (const unit of touched) {
      if (stopped) {
        return;
      }
      let patched = true;
      try {
        if (HAS_CHILDREN) {
          await nest!.patch(unit);
        } else if (unit.model !== unit.rendered) {
          await patch(unit.page, unit.rendered, unit.model);
          unit.rendered = unit.model;
        }
      } catch (error) {
        patched = false;
        report(error);
        if (HAS_ERRORS) {
          fireError(error, unit.page.path);
        }
      }
      if (HAS_REFS) {
        const calls = unit.after?.splice(0);
        if (patched && calls !== undefined) {
          runAfter(unit.page, calls);
        }
      }
    }
    if (HAS_SUBS) {
      for (const { event } of batch) {
        event.done?.();
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
  const subsHost: SubsHost = {
    load: async (marker, name) => {
      const root = findRoot(marker);
      if (root === undefined) {
        throw new Error(`idlip: no state for the source ${name}`);
      }
      // A marker inside a child names a source of the child's module.
      const unit = HAS_CHILDREN
        ? nest!.target(root, {
            message: { t: '', p: [] },
            target: marker,
            type: 'value',
            latest: false,
          })
        : root;
      const { page } = unit ?? root;
      return page.load(page.manifest.module, `source=${name}`);
    },
    push: (event) => {
      events.push(event);
    },
    report,
  };
  const stopSubs = HAS_SUBS ? startSubs(subsHost) : undefined;
  const stopHead = HAS_HEAD ? startHead() : undefined;
  flush().catch(report);

  function stop(): void {
    stopSubs?.();
    stopHead?.();
    if (import.meta.hot) {
      stopHotSubs?.();
    }
    stopped = true;
    queue.length = 0;
    Reflect.deleteProperty(events, 'push');
  }

  return { stop, settled };
}
