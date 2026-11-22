// The network panel of a frame: every request the frame's document makes, as its Resource Timing
// reports it, split into the requests of the load and the requests after the first event in the
// frame. The landing demo uses it, and the REPL can too.
import { formatBytes } from '../../landing/format.ts';

/** A built chunk of component code: `<module>.<kind>.<name>.<hash>.js`. */
const COMPONENT_CHUNK = /\.(handler|binding|list|task|source|try|view)\./;

export interface NetworkPanel {
  /** The requests of the load. */
  load: HTMLElement;
  /** The requests after the first event. */
  events: HTMLElement;
  /** The component code bytes of each group. */
  loadCode: HTMLElement;
  eventsCode: HTMLElement;
}

function isTiming(entry: PerformanceEntry): entry is PerformanceResourceTiming {
  return 'encodedBodySize' in entry;
}

function isObserverClass(value: unknown): value is typeof PerformanceObserver {
  return typeof value === 'function';
}

/**
 * The body size the frame got, or `undefined` for a cached or 304 response, where only the
 * header bytes went over the network.
 */
function getSize(entry: PerformanceResourceTiming): number | undefined {
  if (entry.encodedBodySize === 0 && entry.decodedBodySize === 0) {
    return undefined;
  }
  return entry.encodedBodySize || entry.decodedBodySize;
}

function formatSize(bytes: number | undefined): string {
  return bytes === undefined ? 'cached' : formatBytes(bytes);
}

/** The name a row shows: the file name, or the path of a document. */
function getLabel(entry: PerformanceResourceTiming, frame: Window): string {
  const url = new URL(entry.name, frame.location.href);
  if (entry.entryType === 'navigation') {
    return `GET ${url.pathname}`;
  }
  return url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
}

function createRow(label: string, size: number | undefined): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'net-row is-new';
  const name = document.createElement('span');
  name.className = 'net-name';
  name.textContent = label;
  const bytes = document.createElement('span');
  bytes.className = 'net-size';
  bytes.textContent = formatSize(size);
  row.append(name, bytes);
  // The row fades in on the next frame, once its start state has painted.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      row.classList.remove('is-new');
    });
  });
  return row;
}

function showEmpty(list: HTMLElement, text: string): void {
  const empty = document.createElement('li');
  empty.className = 'net-empty';
  empty.textContent = text;
  list.replaceChildren(empty);
}

/**
 * Lists the requests of the frame's current document, and the ones it makes later. Call it on
 * each `load` of the frame. Returns a function that stops watching.
 */
export function watchFrame(frame: HTMLIFrameElement, panel: NetworkPanel): () => void {
  const view = frame.contentWindow;
  const page = frame.contentDocument;
  if (!view || !page) {
    return () => {};
  }
  let eventAt = Number.POSITIVE_INFINITY;
  const code = { load: 0, events: 0 };
  showEmpty(panel.load, 'No request');
  showEmpty(panel.events, 'Nothing yet. Check a todo.');
  panel.loadCode.textContent = formatSize(0);
  panel.eventsCode.textContent = formatSize(0);
  const seen = { load: false, events: false };

  function add(entry: PerformanceResourceTiming): void {
    if (!view) {
      return;
    }
    const group = entry.startTime >= eventAt ? 'events' : 'load';
    const list = panel[group];
    if (!seen[group]) {
      seen[group] = true;
      list.replaceChildren();
    }
    list.append(createRow(getLabel(entry, view), getSize(entry)));
    if (COMPONENT_CHUNK.test(entry.name)) {
      code[group] += getSize(entry) ?? 0;
      const total = group === 'load' ? panel.loadCode : panel.eventsCode;
      total.textContent = formatSize(code[group]);
    }
  }

  // The first pointer or key event in the frame splits the load from the events.
  function markEvent(): void {
    if (view && eventAt === Number.POSITIVE_INFINITY) {
      eventAt = view.performance.now();
    }
  }
  page.addEventListener('pointerdown', markEvent, { capture: true });
  page.addEventListener('keydown', markEvent, { capture: true });

  // The document first, then every resource so far, then each new one as it finishes.
  for (const entry of view.performance.getEntriesByType('navigation')) {
    if (isTiming(entry)) {
      add(entry);
    }
  }
  // The frame's own observer class: one from the page would watch the page's requests.
  const Observer: unknown = Reflect.get(view, 'PerformanceObserver');
  if (!isObserverClass(Observer)) {
    return () => {};
  }
  const observer = new Observer((list) => {
    for (const entry of list.getEntries()) {
      if (isTiming(entry)) {
        add(entry);
      }
    }
  });
  observer.observe({ type: 'resource', buffered: true });
  return () => {
    observer.disconnect();
  };
}
