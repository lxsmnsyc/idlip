// The render worker of the REPL runs the code of the files: top-level code, components and
// server modules. A worker the page creates has the site's origin, so it could fetch the site
// with the reader's credentials or open its storage. This file starts the worker inside a hidden
// sandboxed frame instead (`allow-scripts`, no `allow-same-origin`). The frame makes a worker
// from the worker's code, and a worker made from a blob in a frame without an origin has no
// origin either. It is a classic worker: a module worker cannot load its blob without an origin.
// The worker bundle has no imports, so it runs as a classic script. The page and the frame talk by `postMessage` only.
import type { WorkerLike } from './requests.ts';
import { FRAME_SANDBOX } from './sandbox.ts';

/**
 * The document of the host frame. It starts the worker when the page sends the worker's code,
 * and then passes messages both ways. It answers only the page, and sends only to the origin of
 * the page.
 */
export function writeHostDocument(origin: string): string {
  const target = JSON.stringify(origin);
  return `<!doctype html><title>REPL render host</title><script>(function(){var w;var send=function(m){parent.postMessage(m,${target})};addEventListener('message',function(e){var d=e.data;if(e.source!==parent||!d||typeof d!=='object')return;if(typeof d.idlipWorkerCode==='string'&&!w){w=new Worker(URL.createObjectURL(new Blob([d.idlipWorkerCode],{type:'text/javascript'})));w.onmessage=function(m){send({idlipFromWorker:m.data})};w.onerror=function(m){send({idlipWorkerError:String(m.message)})};send({idlipHostStarted:1});return}if('idlipToWorker' in d&&w)w.postMessage(d.idlipToWorker)});send({idlipHostReady:1})})()</script>`;
}

/**
 * Starts a render worker in a sandboxed frame. `loadCode` gives the code of the worker bundle.
 * Messages posted before the frame is ready wait and go in order.
 */
export function createSandboxedWorker(loadCode: () => Promise<string>): WorkerLike {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', FRAME_SANDBOX);
  frame.hidden = true;
  frame.title = 'REPL render host';
  const waiting: unknown[] = [];
  let started = false;
  let stopped = false;
  let onMessage: (data: unknown) => void = () => {};
  let onError: (message: string) => void = () => {};

  function post(message: unknown): void {
    frame.contentWindow?.postMessage(message, '*');
  }

  function flush(): void {
    started = true;
    for (const message of waiting.splice(0)) {
      post({ idlipToWorker: message });
    }
  }

  // The frame has no origin, so its messages come from `null`.
  function receive(event: MessageEvent<unknown>): void {
    const data: unknown = event.data;
    if (
      stopped ||
      event.source !== frame.contentWindow ||
      event.origin !== 'null' ||
      typeof data !== 'object' ||
      data === null
    ) {
      return;
    }
    if (Reflect.has(data, 'idlipHostReady')) {
      loadCode().then(
        (code) => {
          post({ idlipWorkerCode: code });
        },
        (error: unknown) => {
          onError(error instanceof Error ? error.message : String(error));
        },
      );
    } else if (Reflect.has(data, 'idlipHostStarted')) {
      flush();
    } else if (Reflect.has(data, 'idlipWorkerError')) {
      onError(String(Reflect.get(data, 'idlipWorkerError')));
    } else if (Reflect.has(data, 'idlipFromWorker')) {
      onMessage(Reflect.get(data, 'idlipFromWorker'));
    }
  }

  window.addEventListener('message', receive);
  frame.srcdoc = writeHostDocument(location.origin);
  document.body.append(frame);

  return {
    postMessage: (message) => {
      if (started) {
        post({ idlipToWorker: message });
      } else {
        waiting.push(message);
      }
    },
    // Removing the frame ends the worker with it.
    terminate: () => {
      stopped = true;
      window.removeEventListener('message', receive);
      frame.remove();
    },
    listen: (messages, errors) => {
      onMessage = messages;
      onError = errors;
    },
  };
}
