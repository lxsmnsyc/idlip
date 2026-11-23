import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Manifest, PageState, RenderContext } from '../../src/core/format.ts';
import { createPolicy } from '../../src/server/response.ts';
import { readStyles, renderStyles } from '../../src/server/styles.ts';
import type * as Server from '../../src/server/index.ts';

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
  loader: '/built/loader.js',
  styles: '/a/k.css /a/k&2.css',
};

function documentComponent(_props: unknown, context?: RenderContext): string {
  const state: PageState = { manifest, chunks, model: {}, props: {} };
  context?.state(state);
  return '<html lang="en"><head><meta charset="utf-8"></head><body><p>hi</p></body></html>';
}

async function load(dev: boolean): Promise<typeof Server> {
  vi.resetModules();
  vi.doMock('../../src/core/dev.ts', async (original) => ({
    ...(await original<object>()),
    DEV: dev,
  }));
  return import('../../src/server/index.ts');
}

afterEach(() => {
  vi.doUnmock('../../src/core/dev.ts');
});

describe('stylesheet links', () => {
  it('reads and writes the URLs', () => {
    expect(readStyles(undefined)).toEqual([]);
    expect(readStyles('')).toEqual([]);
    expect(readStyles('/a.css /b.css')).toEqual(['/a.css', '/b.css']);
    expect(renderStyles(['/a.css'])).toBe('<link rel="stylesheet" href="/a.css">');
    expect(renderStyles(['/a&b.css'], 'n"1')).toBe(
      '<link rel="stylesheet" href="/a&amp;b.css" nonce="n&quot;1">',
    );
    expect(renderStyles([])).toBe('');
  });

  it('links the stylesheets in the head before the preload links, with the nonce', async () => {
    const { renderToResponse } = await load(false);
    const response = await renderToResponse(documentComponent, {}, { nonce: 'abc' });
    const html = await response.text();
    const link = '<link rel="stylesheet" href="/a/k.css" nonce="abc">';
    expect(html).toContain(`${link}<link rel="stylesheet" href="/a/k&amp;2.css" nonce="abc">`);
    expect(html.indexOf(link)).toBeLessThan(html.indexOf('</head>'));
    expect(html.indexOf(link)).toBeLessThan(html.indexOf('<link rel="modulepreload"'));
  });

  it('keeps the stylesheets out of the state script and the chunks of the page', async () => {
    const { render } = await load(false);
    const page = await render(documentComponent, {});
    expect(page.styles).toEqual(['/a/k.css', '/a/k&2.css']);
    expect(Object.keys(page.chunks)).not.toContain('styles');
    expect(page.body).not.toContain('k.css');
  });
});

describe('the policy for stylesheets', () => {
  it('allows the same origin and the nonce', () => {
    expect(createPolicy('n1')).toContain("style-src 'self' 'nonce-n1'");
  });

  it('takes the sources of extend instead of its own', () => {
    const policy = createPolicy('n1', {
      extend: { 'style-src': ["'self'", 'https://fonts.test'] },
    });
    expect(policy).toContain("style-src 'self' https://fonts.test;");
    expect(policy).not.toContain("'nonce-n1'; base-uri");
    expect(policy.match(/style-src/g)).toHaveLength(1);
  });
});
