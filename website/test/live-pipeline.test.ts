import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFrameUrl, prebuildLiveSamples } from '../src/live/prebuild.ts';
import { answerRequest } from '../src/repl/answer.ts';
import type { Render } from '../src/repl/answer.ts';
import type { FromWorker, ToWorker } from '../src/repl/protocol.ts';
import { createRequester } from '../src/repl/requests.ts';
import type { WorkerLike } from '../src/repl/requests.ts';
import { createRunner } from '../src/repl/runner.ts';
import type { RunnerServices } from '../src/repl/runner.ts';

const COUNTER = `export default function Counter() {
  let count = 0;
  function increment() {
    count = count + 1;
  }
  return <button on:click={increment}>{count}</button>;
}
`;

const RENDERED = { head: '', body: '<p>ok</p>' };

function createRequest(id: number): ToWorker {
  return {
    id,
    project: { files: [], problems: [], props: {}, ok: true, helpers: '' },
    chunks: [],
    folder: '',
  };
}

/** A fake worker that keeps the requests it gets and answers when asked. */
class FakeWorker implements WorkerLike {
  received: ToWorker[] = [];
  terminated = false;
  listeners: ((data: unknown) => void)[] = [];

  postMessage(message: ToWorker): void {
    this.received.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  listen(onMessage: (data: unknown) => void): void {
    this.listeners.push(onMessage);
  }

  send(message: FromWorker): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}

describe('the worker requests', () => {
  const revoked: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    revoked.length = 0;
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fails only the slow request, and sends the others to a new worker with a new limit', async () => {
    const workers: FakeWorker[] = [];
    const ask = createRequester(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
    const slow = ask(createRequest(1), 5000);
    const slowResult = slow.catch((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    );
    await vi.advanceTimersByTimeAsync(4000);
    const other = ask(createRequest(2), 5000);
    workers[0].send({ kind: 'blob', id: 1, url: 'blob:slow' });
    workers[0].send({ kind: 'blob', id: 2, url: 'blob:other' });

    // The slow request passes its limit. Its worker ends, and the page revokes the worker's URLs.
    await vi.advanceTimersByTimeAsync(1000);
    expect(await slowResult).toBe('The render did not finish in 5 s.');
    expect(workers[0].terminated).toBe(true);
    expect(revoked).toEqual(['blob:slow', 'blob:other']);
    expect(workers[1].received.map((request) => request.id)).toEqual([2]);

    // The replayed request gets a full new limit, not the 1 s its old timer had left.
    await vi.advanceTimersByTimeAsync(4900);
    workers[1].send({ kind: 'rendered', id: 2, rendered: RENDERED });
    expect(await other).toEqual({ kind: 'rendered', id: 2, rendered: RENDERED });
  });

  it('ignores the answers of a worker it ended', async () => {
    const workers: FakeWorker[] = [];
    const ask = createRequester(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
    const slow = ask(createRequest(1), 100).catch(() => 'failed');
    const other = ask(createRequest(2), 5000);
    await vi.advanceTimersByTimeAsync(100);
    expect(await slow).toBe('failed');
    workers[0].send({ kind: 'rendered', id: 2, rendered: { head: 'old', body: '' } });
    workers[1].send({ kind: 'rendered', id: 2, rendered: RENDERED });
    expect(await other).toEqual({ kind: 'rendered', id: 2, rendered: RENDERED });
  });
});

describe('the worker answer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('revokes the module URLs of a render when it ends, not when another starts', async () => {
    let made = 0;
    const revoked: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++made}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url);
    });
    const finish: (() => void)[] = [];
    const render: Render = async (_project, _chunks, _folder, createUrl) => {
      createUrl('code');
      await new Promise<void>((resolve) => {
        finish.push(resolve);
      });
      return RENDERED;
    };
    const posted: FromWorker[] = [];
    const post = (message: FromWorker): void => {
      posted.push(message);
    };
    const first = answerRequest(createRequest(1), post, render);
    const second = answerRequest(createRequest(2), post, render);
    await Promise.resolve();

    // The second render finishes first. The first render's module is still there.
    finish[1]();
    expect(await second).toEqual({ kind: 'rendered', id: 2, rendered: RENDERED });
    expect(revoked).toEqual(['blob:2']);
    finish[0]();
    await first;
    expect(revoked).toEqual(['blob:2', 'blob:1']);
    expect(posted).toEqual([
      { kind: 'blob', id: 1, url: 'blob:1' },
      { kind: 'blob', id: 2, url: 'blob:2' },
    ]);
  });

  it('answers failed when the render throws', async () => {
    const render: Render = async () => Promise.reject(new Error('boom'));
    expect(await answerRequest(createRequest(3), () => undefined, render)).toEqual({
      kind: 'failed',
      id: 3,
      message: 'boom',
    });
  });
});

describe('the runner', () => {
  function createServices(stored: string[]): RunnerServices {
    let ids = 0;
    let urls = 0;
    return {
      serve: async () => Promise.resolve('https://site.test/assets/repl-run/'),
      ask: async (request) =>
        Promise.resolve({ kind: 'rendered', id: request.id, rendered: RENDERED }),
      store: async (own, folder) => {
        expect(folder.startsWith(own)).toBe(true);
        stored.push(folder);
        return Promise.resolve();
      },
      runtime: () => 'https://site.test/assets/runtime.js',
      createId: () => `owner-${++ids}`,
      createUrl: () => `blob:${++urls}`,
      revokeUrl: () => undefined,
    };
  }

  it('gives each runner its own run folder', async () => {
    const stored: string[] = [];
    const services = createServices(stored);
    const first = createRunner(services);
    const second = createRunner(services);
    const files = [{ name: 'counter.tsx', source: COUNTER }];
    await first(files, '', true);
    await second(files, '', true);
    const last = await first(files, '', true);
    expect(stored).toEqual([
      'https://site.test/assets/repl-run/owner-1/1/',
      'https://site.test/assets/repl-run/owner-2/1/',
      'https://site.test/assets/repl-run/owner-1/2/',
    ]);
    expect(last.kind).toBe('served');
  });

  it('only compiles when told not to render or when a file has an error', async () => {
    const stored: string[] = [];
    const run = createRunner(createServices(stored));
    expect((await run([{ name: 'a.tsx', source: COUNTER }], '', false)).kind).toBe('compiled');
    const broken = await run(
      [{ name: 'a.tsx', source: 'export default function A() {' }],
      '',
      true,
    );
    expect(broken.kind).toBe('compiled');
    expect(broken.project.ok).toBe(false);
    expect(stored).toEqual([]);
  });
});

describe('the static frames', () => {
  let outDir = '';

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('writes the page, the chunks, the shim and the Compiled tab of each sample', async () => {
    outDir = mkdtempSync(path.join(tmpdir(), 'live-'));
    await prebuildLiveSamples(
      [{ file: 'docs/x.md', id: 'x-1', files: [{ name: 'counter.tsx', source: COUNTER }] }],
      { outDir, base: '/base/', runtime: '/base/assets/runtime-abc.js' },
    );
    const folder = path.join(outDir, 'live', 'x-1');
    const names = readdirSync(folder).toSorted();
    expect(names).toContain('index.html');
    expect(names).toContain('idlip.js');
    expect(names).toContain('compiled.html');
    expect(names).toContain('counter.handler.increment.js');

    const page = readFileSync(path.join(folder, 'index.html'), 'utf8');
    expect(page).toContain('<script type="module" src="/base/assets/runtime-abc.js">');
    expect(page).toContain('<link rel="stylesheet" href="/base/live/frame.css">');
    expect(page).toContain('<button');
    // The state names the chunks by their address in the frame's folder.
    expect(page).toContain(`${getFrameUrl('/base/', 'x-1')}counter.handler.increment.js`);

    // No chunk imports the runtime by its package name: the frame has no import map.
    for (const name of names) {
      if (name.endsWith('.js') && name !== 'idlip.js') {
        const code = readFileSync(path.join(folder, name), 'utf8');
        expect(code, name).not.toMatch(/from\s*'idlip(?:\/client)?'/);
      }
    }
    const compiled = readFileSync(path.join(folder, 'compiled.html'), 'utf8');
    expect(compiled).toContain('counter.handler.increment.js');
    expect(compiled).toMatch(/class="live-module-size">\d+ B</);
  });

  it('serves the chunks of every component of a file', async () => {
    outDir = mkdtempSync(path.join(tmpdir(), 'live-'));
    const source = `export function Counter(props: { start: number }) {
  let count = props.start;
  function increment() {
    count = count + 1;
  }
  return <button on:click={increment}>{count}</button>;
}

export default function Panel() {
  let title = 'Counters';
  function rename() {
    title = title + '!';
  }
  return (
    <section>
      <h2 on:click={rename}>{title}</h2>
      <Counter start={1} />
    </section>
  );
}
`;
    await prebuildLiveSamples(
      [{ file: 'docs/x.md', id: 'x-3', files: [{ name: 'panel.tsx', source }] }],
      { outDir, base: '/', runtime: '/assets/runtime.js' },
    );
    const folder = path.join(outDir, 'live', 'x-3');
    expect(readdirSync(folder)).toContain('panel.Counter.handler.increment.js');
    const page = readFileSync(path.join(folder, 'index.html'), 'utf8');
    // The state points the chunk of the named component at its file in the frame folder.
    expect(page).toContain('/live/x-3/panel.Counter.handler.increment.js');
    expect(page).not.toContain('idlip-Counter.handler=increment&lang.js\\":\\"/src/');
  });

  it('fails on a sample that does not render', async () => {
    outDir = mkdtempSync(path.join(tmpdir(), 'live-'));
    const source =
      'export default function Bad(props: { items: string[] }) {\n  let items = props.items;\n  function clear() {\n    items = [];\n  }\n  return <ul on:click={clear}>{items.length}</ul>;\n}\n';
    await expect(
      prebuildLiveSamples(
        [{ file: 'docs/x.md', id: 'x-2', files: [{ name: 'bad.tsx', source }] }],
        {
          outDir,
          base: '/',
          runtime: '/assets/runtime.js',
        },
      ),
    ).rejects.toThrow('docs/x.md: the live sample x-2 did not render');
  });
});
