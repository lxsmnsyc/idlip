import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Manifest, PageState, RenderContext } from '../../src/core/format.ts';
import {
  render,
  renderListener,
  renderPreload,
  renderToStream,
  streamParts,
} from '../../src/server/index.ts';

// Compiled fixture modules import the helpers from the package. Point them at this source.
vi.mock('idlip/server', async () => import('../../src/server/index.ts'));

const FIXTURES = join(import.meta.dirname, '../fixtures');

const manifest: Manifest = {
  module: '/k',
  events: ['click'],
  handlers: { go: { chunk: 'handler=go' } },
  groups: {},
  lists: {},
  listens: { click: ['go'] },
  document: true,
};

const chunks = {
  '/k?idlip-handler=go&lang.js': '/a/go.js',
  build: 'b1',
  loader: '/built/loader.js',
};

/** The context of a compiled module: the render context and the head calls of `<Head>`. */
interface HeadContext extends RenderContext {
  headId(): number;
  head(id: number, markup: string): void;
}

type Component = (props: unknown, context?: HeadContext) => string;

/**
 * A document component that records its state, and a `<Head>` block when `head` is set. `lang`
 * is written on `<html>`, and `inHead` is static markup in `<head>`.
 */
function makeComponent(
  head?: string,
  extra: { lang?: string; inHead?: string; chunkMap?: Record<string, string> } = {},
): Component {
  const { lang = 'en', inHead = '<meta charset="utf-8">', chunkMap = chunks } = extra;
  return (_props, context) => {
    const state: PageState = { manifest, chunks: chunkMap, model: { n: 1 }, props: {} };
    context?.state(state);
    if (head !== undefined && context !== undefined) {
      context.head(context.headId(), head);
    }
    return `<html lang="${lang}"><head>${inHead}</head><body><p>hi</p></body></html>`;
  };
}

async function readChunks(stream: ReadableStream<string>): Promise<string[]> {
  const out: string[] = [];
  const reader = stream.getReader();
  for (;;) {
    const step = await reader.read();
    if (step.done) {
      return out;
    }
    out.push(step.value);
  }
}

function isComponent(value: unknown): value is (props: unknown) => unknown {
  return typeof value === 'function';
}

describe('renderToStream', () => {
  it('renders when it is constructed, before the reader reads', async () => {
    const rendered = vi.fn(makeComponent());
    renderToStream(rendered, {});
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(rendered).toHaveBeenCalledOnce();
  });

  it('writes the doctype, the head scripts and the state script in the component document', async () => {
    const stream = renderToStream(makeComponent(), {}, { nonce: 'n1' });
    const out = await readChunks(stream);
    expect(out).toHaveLength(1);
    const [first = ''] = out;
    expect(first.startsWith('<!doctype html><html lang="en"><head><meta charset="utf-8">')).toBe(
      true,
    );
    // The listener, the links and the loader script come at the end of the head, from the chunk map.
    expect(first).toContain(renderListener({ nonce: 'n1' }));
    expect(first).toContain('<link rel="modulepreload" href="/a/go.js" nonce="n1">');
    expect(first).toContain(
      '<script type="module" async src="/built/loader.js" nonce="n1"></script></head><body>',
    );
    // The state script is the last child of the body, and the chunk map does not carry the loader.
    expect(first.indexOf('<body><p>hi</p>')).toBeLessThan(first.indexOf('<script i-state'));
    expect(first.endsWith('</script></body></html>')).toBe(true);
    const inBody = first.slice(first.indexOf('<body>'));
    expect(inBody).not.toContain('/built/loader.js');
    // A nonce on each script and link the server adds.
    expect(first.match(/<script/g)).toHaveLength(3);
    expect(first.match(/<link/g)).toHaveLength(1);
    expect(first.match(/nonce="n1"/g)).toHaveLength(4);
  });

  it('takes the loader option over the one of the chunk map', async () => {
    const html = (await readChunks(renderToStream(makeComponent(), {}, { loader: '/l.js' }))).join(
      '',
    );
    expect(html).toContain('<script type="module" async src="/l.js"></script>');
    expect(html).not.toContain('/built/loader.js');
  });

  it('writes the head output first in the head, the winning title before the static elements', async () => {
    const component = makeComponent('<title>x</title>');
    const html = (await readChunks(renderToStream(component, {}))).join('');
    const page = await render(component, {});
    expect(html).toBe(
      `<!doctype html><html lang="en"><head>${page.head}<meta charset="utf-8">` +
        `${renderListener()}${renderPreload(page.chunks, page.manifests)}` +
        `<script type="module" async src="/built/loader.js"></script></head><body>` +
        `<p>hi</p>${page.body.slice(page.body.indexOf('<script i-state'), -'</body></html>'.length)}</body></html>`,
    );
    expect(html.indexOf('<title>x</title>')).toBeLessThan(html.indexOf('<meta charset'));
  });

  it('finds the head after an html tag with a quoted greater-than sign', async () => {
    const html = (
      await readChunks(renderToStream(makeComponent(undefined, { lang: 'a>b<head>' }), {}))
    ).join('');
    expect(html).toContain('<html lang="a>b<head>"><head><meta charset="utf-8">');
    expect(html.indexOf('<script type="module"')).toBeGreaterThan(html.indexOf('<meta charset'));
  });

  it('rejects a component that does not render <html>', async () => {
    for (const name of ['counter', 'todo', 'try', 'effects']) {
      const dir = join(FIXTURES, name);
      const input: unknown = JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'));
      const props: unknown = Reflect.get(Object(input), 'props');
      const mod: unknown = await import(join(dir, 'expected/server.js'));
      const component: unknown = Reflect.get(Object(mod), 'default');
      if (!isComponent(component)) {
        throw new TypeError('bad module');
      }
      // A fragment still renders its parts.
      const page = await render(component, props);
      expect(page.document).toBe(false);
      await expect(readChunks(renderToStream(component, props))).rejects.toThrow(
        'must render <html>',
      );
    }
  });

  it('leaves out the links when asked, and the loader script when none is known', async () => {
    const { loader: _loader, ...plain } = chunks;
    const html = (
      await readChunks(
        renderToStream(makeComponent(undefined, { chunkMap: plain }), {}, { preload: false }),
      )
    ).join('');
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain('modulepreload');
  });

  it('fails the stream before it sends a byte when the component throws', async () => {
    const stream = renderToStream(() => {
      throw new Error('boom');
    }, {});
    await expect(stream.getReader().read()).rejects.toThrow('boom');
  });
});

describe('streamParts', () => {
  it('streams what render returned', async () => {
    const page = await render(makeComponent(), {});
    const parts = await readChunks(streamParts(page));
    expect(parts).toHaveLength(1);
    const whole = (await readChunks(renderToStream(makeComponent(), {}))).join('');
    expect(parts.join('')).toBe(whole);
  });
});

describe('pending chunks', () => {
  // oxlint-disable-next-line require-await
  async function* later(log: string[]): AsyncGenerator<string> {
    try {
      yield '<script>1</script>';
      yield '<script>2</script>';
    } finally {
      log.push('closed');
    }
  }

  it('come after the first chunk and before the end of the body', async () => {
    const page = await render(makeComponent(), {});
    const log: string[] = [];
    const out = await readChunks(streamParts({ ...page, pending: later(log) }));
    expect(out).toHaveLength(4);
    expect(out[0]).toContain('<body><p>hi</p><script i-state');
    expect(out[0]).not.toContain('</body>');
    expect(out.slice(1)).toEqual(['<script>1</script>', '<script>2</script>', '</body></html>']);
  });

  it('stop when the reader leaves while a chunk is in flight', async () => {
    const page = await render(makeComponent(), {});
    const log: string[] = [];
    let aborted: unknown;
    // A generator that awaits a chunk that never arrives, until the signal aborts. Its `return()`
    // queues behind that `next()`, as a real loader's does.
    async function* stuck(): AsyncGenerator<string> {
      try {
        await new Promise<void>((resolve) => {
          page.signal.addEventListener('abort', () => {
            aborted = page.signal.reason;
            resolve();
          });
        });
        yield '<script>never</script>';
      } finally {
        log.push('finally');
      }
    }
    const reader = streamParts({ ...page, pending: stuck() }).getReader();
    await reader.read();
    // The next read starts the chunk that never arrives.
    const read = reader.read();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    await reader.cancel('gone');
    expect(aborted).toBe('gone');
    expect((await read).done).toBe(true);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(log).toEqual(['finally']);
  });

  it('stop when the reader leaves', async () => {
    const page = await render(makeComponent(), {});
    expect(page.pending).toBeDefined();
    const log: string[] = [];
    const reader = streamParts({ ...page, pending: later(log) }).getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();
    expect(log).toEqual(['closed']);
  });
});
