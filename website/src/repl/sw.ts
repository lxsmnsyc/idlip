// The service worker of the REPL. It answers the requests of a run from the cache the REPL page
// fills: the frame document and its client chunks. So the frame loads its chunks over fetch, and
// the network panel lists each one, as it does for a built app. Other requests go to the network.
export {};

/** The cache that `run.ts` fills. */
const CACHE = 'idlip-repl';

interface FetchEvent extends Event {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}

interface WorkerScope {
  readonly registration: { readonly scope: string };
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const worker = self as unknown as WorkerScope;

async function answer(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const found = await cache.match(request.url);
  return found ?? new Response('This run is over. Run the code again.', { status: 404 });
}

function isExtendable(event: Event): event is ExtendableEvent {
  return 'waitUntil' in event;
}

function isFetch(event: Event): event is FetchEvent {
  return 'request' in event && 'respondWith' in event;
}

// A new worker takes over at once, so a deploy never runs the frame through an old one.
worker.addEventListener('install', (event) => {
  if (isExtendable(event)) {
    event.waitUntil(worker.skipWaiting());
  }
});

worker.addEventListener('activate', (event) => {
  if (isExtendable(event)) {
    event.waitUntil(worker.clients.claim());
  }
});

worker.addEventListener('fetch', (event) => {
  if (
    isFetch(event) &&
    event.request.method === 'GET' &&
    event.request.url.startsWith(worker.registration.scope)
  ) {
    event.respondWith(answer(event.request));
  }
});
