// Starts and stops the sources of `<Subscribe>` blocks. A block is `<!--c<id>:s--><template
// i-sub="<name>" i-input="<json>" i-key="<json>" on:value="<message>"></template><!--/c-->`.
// The loader starts the sources whose markers are in the page, and the block hooks start and stop
// the markers of blocks that patches add and remove. `contracts/compiled-format-subscribe.change-request.md`
// describes the marker.
import { DEV } from '../../core/dev.ts';
import type { QueuedCall, QueuedEvent, QueuedMessage } from '../../core/format.ts';
import { HAS_SUBS } from '../features.ts';
import { onBlock } from '../patch/blocks.ts';

/** What the loader gives the subscriptions. */
export interface SubsHost {
  /** Loads the chunk `source=<name>` of the page that holds the marker. */
  readonly load: (marker: Element, name: string) => Promise<unknown>;
  /** Queues a value as an event. */
  readonly push: (event: QueuedEvent) => void;
  readonly report: (error: unknown) => void;
}

type Source = (input: unknown, signal: AbortSignal) => AsyncIterable<unknown>;

/** One start of a source. A restart makes a new run. */
interface Run {
  readonly controller: AbortController;
  /** Set when the source chunk has loaded. A run stopped before that has none. */
  iterator: AsyncIterator<unknown> | undefined;
}

/**
 * The lifecycle of one marker. `running` delivers values. `stopping` has aborted its run and
 * waits for `return()` to settle, and delivers nothing. A marker with no entry is `idle`.
 */
type Sub =
  | { readonly phase: 'idle' }
  | { readonly phase: 'running'; readonly run: Run }
  | { readonly phase: 'stopping'; readonly run: Run };

/** Dev builds warn when `return()` has not settled this long after the abort. */
const RETURN_WARNING_MS = 1000;

const IDLE: Sub = { phase: 'idle' };
const subs = new WeakMap<Element, Sub>();
/** The markers that are running, so a stop can reach every one. */
const running = new Set<Element>();
let host: SubsHost | undefined;
let hooked = false;

function getSub(marker: Element): Sub {
  return subs.get(marker) ?? IDLE;
}

/** Reads the flag again: it changes while the source runs, which a narrowed type misses. */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function warn(message: string): void {
  // oxlint-disable-next-line no-console
  console.warn(message);
}

/** Reads the `on:value` of a marker: an event function, or a message built at render. */
function readCall(
  marker: Element,
  value: unknown,
): Pick<QueuedMessage, 'message'> | Pick<QueuedCall, 'site' | 'event' | 'current'> {
  const raw = marker.getAttribute('on:value');
  if (raw === null) {
    throw new Error('idlip: a <Subscribe> marker has no on:value');
  }
  if (!raw.startsWith('[')) {
    return { site: raw.split(' ')[0], event: value, current: marker };
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const [tag, payload] = JSON.parse(raw) as [string, unknown[]];
  return { message: { t: tag, p: payload } };
}

function readInput(marker: Element): unknown {
  const raw = marker.getAttribute('i-input');
  return raw === null ? undefined : JSON.parse(raw);
}

/** Ends a run that finished or failed on its own, if it is still the marker's run. */
function finish(marker: Element, run: Run): void {
  const sub = getSub(marker);
  if (sub.phase === 'running' && sub.run === run) {
    subs.delete(marker);
    running.delete(marker);
  }
}

async function deliver(
  { push }: SubsHost,
  marker: Element,
  run: Run,
  value: unknown,
): Promise<void> {
  const { signal } = run.controller;
  const call = readCall(marker, value);
  // The next value is asked for after the batch of this one has patched, or at the abort.
  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => {
      resolve();
    });
    push({ ...call, target: marker, type: 'value', latest: false, done: resolve, signal });
  });
}

async function pump(next: SubsHost, marker: Element, run: Run): Promise<void> {
  const { signal } = run.controller;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const chunk = (await next.load(marker, marker.getAttribute('i-sub') ?? '')) as {
      source?: Source;
    };
    if (signal.aborted) {
      return;
    }
    if (typeof chunk.source !== 'function') {
      throw new TypeError(`idlip: no source ${marker.getAttribute('i-sub')}`);
    }
    run.iterator = chunk.source(readInput(marker), signal)[Symbol.asyncIterator]();
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop
      const step = await run.iterator.next();
      // A value that arrives after the stop is dropped.
      if (isAborted(signal)) {
        return;
      }
      if (step.done === true) {
        finish(marker, run);
        return;
      }
      // oxlint-disable-next-line no-await-in-loop
      await deliver(next, marker, run, step.value);
    }
  } catch (error) {
    if (!signal.aborted) {
      finish(marker, run);
      next.report(error);
    }
  }
}

function startSub(marker: Element): void {
  if (host === undefined || getSub(marker).phase === 'running') {
    return;
  }
  const run: Run = { controller: new AbortController(), iterator: undefined };
  subs.set(marker, { phase: 'running', run });
  running.add(marker);
  pump(host, marker, run).catch(host.report);
}

function stopSub(marker: Element): void {
  const sub = getSub(marker);
  if (sub.phase !== 'running') {
    return;
  }
  const { run } = sub;
  subs.set(marker, { phase: 'stopping', run });
  running.delete(marker);
  run.controller.abort();
  function settle(): void {
    const now = getSub(marker);
    if (now.phase === 'stopping' && now.run === run) {
      subs.delete(marker);
    }
  }
  if (run.iterator === undefined) {
    settle();
    return;
  }
  // `return()` is not awaited: it queues behind a `next()` that waits for a quiet source.
  let pending: unknown;
  try {
    pending = run.iterator.return?.();
  } catch {
    settle();
    return;
  }
  Promise.resolve(pending).then(settle, settle);
  if (DEV) {
    setTimeout(() => {
      const now = getSub(marker);
      if (now.phase === 'stopping' && now.run === run) {
        warn(
          `idlip: the source ${marker.getAttribute('i-sub')} did not end ${RETURN_WARNING_MS} ms after its block was removed. Make it stop when its signal aborts.`,
        );
      }
    }, RETURN_WARNING_MS);
  }
}

/** Calls `visit` for the markers of the block that starts at `start`. */
function visitMarkers(start: Comment, visit: (marker: Element) => void): void {
  if (!start.data.endsWith(':s')) {
    return;
  }
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    if (node.nodeType === 8 && node.nodeValue === '/c') {
      return;
    }
    if (isElement(node) && node.hasAttribute('i-sub')) {
      visit(node);
    }
  }
}

/**
 * Called by a binding of a `<Subscribe>` whose `key` reads state. A new `key` stops the run of
 * the marker and starts another with the new `input`. The same `key` changes nothing.
 */
export function restartSub(
  marker: Element,
  input: string | undefined,
  key: string | undefined,
): void {
  if (HAS_SUBS) {
    if (marker.getAttribute('i-key') === (key ?? null)) {
      return;
    }
    for (const [name, value] of [
      ['i-input', input],
      ['i-key', key],
    ] as const) {
      if (value === undefined) {
        marker.removeAttribute(name);
      } else {
        marker.setAttribute(name, value);
      }
    }
    if (getSub(marker).phase === 'running') {
      stopSub(marker);
      startSub(marker);
    }
  }
}

/**
 * Starts the sources whose markers are in the page, and the sources of the blocks that later
 * patches add. Returns a function that stops every run.
 */
export function startSubs(next: SubsHost): () => void {
  host = next;
  if (!hooked) {
    hooked = true;
    onBlock(
      (start) => {
        visitMarkers(start, startSub);
      },
      (start) => {
        visitMarkers(start, stopSub);
      },
    );
  }
  for (const marker of document.querySelectorAll('template[i-sub]')) {
    startSub(marker);
  }
  return () => {
    for (const marker of running) {
      stopSub(marker);
    }
    host = undefined;
  };
}
