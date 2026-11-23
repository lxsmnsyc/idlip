import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Manifest, PageState, RenderContext } from '../../src/core/format.ts';
import {
  renderListener,
  renderPage,
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
};

const chunks = {
  '/k?idlip-handler=go&lang.js': '/a/go.js',
  build: 'b1',
};

/** The context of a compiled module: the render context and the head calls of `<Head>`. */
interface HeadContext extends RenderContext {
  headId(): number;
  head(id: number, markup: string): void;
}

type Component = (props: unknown, context?: HeadContext) => string;

/** A component that records its state, and a `<Head>` block when `head` is set. */
function makeComponent(head?: string): Component {
  return (_props, context) => {
    const state: PageState = { manifest, chunks, model: { n: 1 }, props: {} };
    context?.state(state);
    if (head !== undefined && context !== undefined) {
      context.head(context.headId(), head);
    }
    return '<p>hi</p>';
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
  it('sends the head, the body and the state in the first chunk', async () => {
    const stream = renderToStream(
      makeComponent(),
      {},
      { loader: '/l.js', head: '<title>t</title>' },
    );
    const out = await readChunks(stream);
    expect(out).toHaveLength(1);
    const [first = ''] = out;
    expect(first).toContain('<!doctype html><html><head><title>t</title>');
    expect(first).toContain(renderListener());
    expect(first).toContain('<script type="module" async src="/l.js"></script>');
    expect(first.indexOf('</head>')).toBeLessThan(first.indexOf('<body>'));
    expect(first.indexOf('<body><p>hi</p>')).toBeLessThan(first.indexOf('<script i-state'));
    expect(first.endsWith('</script></body></html>')).toBe(true);
  });

  it('joins to the document of renderPage', async () => {
    const options = { loader: '/l.js', head: '<meta charset="utf-8">', nonce: 'n1' };
    const component = makeComponent('<title>x</title>');
    const html = (await readChunks(renderToStream(component, {}, options))).join('');
    const page = await renderPage(component, {}, { nonce: 'n1' });
    expect(html).toBe(
      `<!doctype html><html><head><meta charset="utf-8">${renderListener({ nonce: 'n1' })}` +
        `<script type="module" async src="/l.js" nonce="n1"></script>` +
        `${renderPreload(page.chunks, page.manifests, { nonce: 'n1' })}${page.head}` +
        `</head><body>${page.body}</body></html>`,
    );
    // The preload link and the `<Head>` output are in the head, the nonce on each script.
    expect(html).toContain('<link rel="modulepreload" href="/a/go.js" nonce="n1">');
    expect(html).toContain('<title>x</title></head>');
    expect(html.match(/<script/g)).toHaveLength(3);
    expect(html.match(/nonce="n1"/g)).toHaveLength(4);
  });

  for (const name of ['counter', 'todo', 'try', 'effects']) {
    it(`joins to the document of renderPage for fixture ${name}`, async () => {
      const dir = join(FIXTURES, name);
      const input: unknown = JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'));
      const props: unknown = Reflect.get(Object(input), 'props');
      const mod: unknown = await import(join(dir, 'expected/server.js'));
      const component: unknown = Reflect.get(Object(mod), 'default');
      if (!isComponent(component)) {
        throw new TypeError('bad module');
      }
      const page = await renderPage(component, props);
      const html = (await readChunks(renderToStream(component, props))).join('');
      expect(html).toBe(
        `<!doctype html><html><head>${renderListener()}` +
          `${renderPreload(page.chunks, page.manifests)}${page.head}` +
          `</head><body>${page.body}</body></html>`,
      );
    });
  }

  it('leaves out the loader and the links when asked', async () => {
    const html = (await readChunks(renderToStream(makeComponent(), {}, { preload: false }))).join(
      '',
    );
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
  it('streams what renderPage returned', async () => {
    const page = await renderPage(makeComponent(), {});
    const parts = await readChunks(streamParts(page, { loader: '/l.js' }));
    expect(parts).toHaveLength(1);
    const whole = (await readChunks(renderToStream(makeComponent(), {}, { loader: '/l.js' }))).join(
      '',
    );
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
    const page = await renderPage(makeComponent(), {});
    const log: string[] = [];
    const out = await readChunks(streamParts({ ...page, pending: later(log) }));
    expect(out).toHaveLength(4);
    expect(out[0]).toContain('<body><p>hi</p><script i-state');
    expect(out[0]).not.toContain('</body>');
    expect(out.slice(1)).toEqual(['<script>1</script>', '<script>2</script>', '</body></html>']);
  });

  it('stop when the reader leaves', async () => {
    const page = await renderPage(makeComponent(), {});
    expect(page.pending).toBeDefined();
    const log: string[] = [];
    const reader = streamParts({ ...page, pending: later(log) }).getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();
    expect(log).toEqual(['closed']);
  });
});
