import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Manifest, PageState, RenderContext } from '../../src/core/format.ts';
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

const chunks = { '/k?idlip-handler=go&lang.js': '/a/go.js', loader: '/built/loader.js' };

function documentComponent(
  _props: unknown,
  context?: RenderContext,
  extra: Partial<Manifest> = {},
): string {
  const state: PageState = { manifest: { ...manifest, ...extra }, chunks, model: {}, props: {} };
  context?.state(state);
  return '<html lang="en"><head><meta charset="utf-8"></head><body><p>hi</p></body></html>';
}

/** Loads the server module with `DEV` set, since the policy header is only sent outside dev. */
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

describe('renderToResponse', () => {
  it('returns the document with an html content type', async () => {
    const { renderToResponse } = await load(false);
    const response = await renderToResponse(documentComponent, {});
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('content-security-policy')).toBeNull();
    const html = await response.text();
    expect(html.startsWith('<!doctype html><html lang="en"><head><meta charset="utf-8">')).toBe(
      true,
    );
    expect(html).toContain('<script type="module" async src="/built/loader.js"></script>');
  });

  it('takes the status and the headers', async () => {
    const { renderToResponse } = await load(false);
    const response = await renderToResponse(
      documentComponent,
      {},
      { status: 404, headers: { 'cache-control': 'no-store', 'content-type': 'text/html' } },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('makes a nonce, writes it on every script and link, and sets the policy', async () => {
    const { renderToResponse } = await load(false);
    const response = await renderToResponse(documentComponent, {}, { csp: true });
    const policy = response.headers.get('content-security-policy') ?? '';
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1] ?? '';
    expect(nonce).toMatch(/^[\w+/]{22}==$/);
    expect(policy).toBe(
      `default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; base-uri 'none'; ` +
        `object-src 'none'; require-trusted-types-for 'script'; trusted-types idlip`,
    );
    const html = await response.text();
    expect(html.match(/<script/g)).toHaveLength(3);
    expect(html.match(/<link/g)).toHaveLength(1);
    expect(html.split(`nonce="${nonce}"`)).toHaveLength(5);
  });

  it('makes a new nonce for each response', async () => {
    const { renderToResponse } = await load(false);
    const first = await renderToResponse(documentComponent, {}, { csp: true });
    const second = await renderToResponse(documentComponent, {}, { csp: true });
    expect(first.headers.get('content-security-policy')).not.toBe(
      second.headers.get('content-security-policy'),
    );
  });

  it('uses the nonce option instead of making one', async () => {
    const { renderToResponse } = await load(false);
    const response = await renderToResponse(documentComponent, {}, { csp: true, nonce: 'mine' });
    expect(response.headers.get('content-security-policy')).toContain("'nonce-mine'");
    expect(await response.text()).toContain('nonce="mine"');
  });

  it('writes a nonce option without a header when csp is off', async () => {
    const { renderToResponse } = await load(false);
    const response = await renderToResponse(documentComponent, {}, { nonce: 'mine' });
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(await response.text()).toContain('nonce="mine"');
  });

  it('adds sources to a directive and adds a directive', async () => {
    const { renderToResponse } = await load(false);
    const response = await renderToResponse(
      documentComponent,
      {},
      {
        csp: {
          extend: {
            'style-src': ["'self'"],
            'img-src': ['https:', 'data:'],
            'default-src': ["'self'"],
          },
        },
      },
    );
    const policy = response.headers.get('content-security-policy') ?? '';
    expect(policy).toContain("; style-src 'self'");
    expect(policy).toContain('; img-src https: data');
    // `'none'` stands alone, so a source replaces it.
    expect(policy.startsWith("default-src 'self'; script-src")).toBe(true);
  });

  it('refuses to loosen the scripts or the trusted types policy, or to write a bad source', async () => {
    const { renderToResponse } = await load(false);
    await expect(
      renderToResponse(
        documentComponent,
        {},
        { csp: { extend: { 'script-src': ["'unsafe-inline'"] } } },
      ),
    ).rejects.toThrow('script-src cannot be extended');
    await expect(
      renderToResponse(documentComponent, {}, { csp: { extend: { 'trusted-types': ['x'] } } }),
    ).rejects.toThrow('trusted-types cannot be extended');
    await expect(
      renderToResponse(
        documentComponent,
        {},
        { csp: { extend: { 'img-src': ['a; script-src *'] } } },
      ),
    ).rejects.toThrow('is not a source of img-src');
    await expect(
      renderToResponse(documentComponent, {}, { csp: { extend: { 'img-src; x': ['a'] } } }),
    ).rejects.toThrow('is not a directive name');
  });

  it('sends no header in development, and still writes the nonce', async () => {
    const { renderToResponse } = await load(true);
    const response = await renderToResponse(documentComponent, {}, { csp: true });
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(await response.text()).toMatch(/<script nonce="[^"]+">/);
  });

  it('rejects before any header when the render fails or the root is not a document', async () => {
    const { renderToResponse } = await load(false);
    await expect(
      renderToResponse(() => {
        throw new Error('boom');
      }, {}),
    ).rejects.toThrow('boom');
    await expect(
      renderToResponse((_props: unknown, context?: RenderContext) => {
        context?.state({
          manifest: { ...manifest, document: undefined },
          chunks,
          model: {},
          props: {},
        });
        return '<p>hi</p>';
      }, {}),
    ).rejects.toThrow('must render <html>');
  });

  it('writes the state script of a document with a bound html as the document root', async () => {
    const { render } = await load(false);
    const page = await render(
      (props: unknown, context?: RenderContext) =>
        documentComponent(props, context, { documentRoot: true }),
      {},
    );
    expect(page.document).toBe(true);
    expect(page.loader).toBe('/built/loader.js');
    expect(page.body).toContain('<script i-state="document">');
    expect(page.body.endsWith('</script></body></html>')).toBe(true);
    // The loader URL is for the script tag, so the state does not carry it.
    expect(page.body).not.toContain('/built/loader.js');
    expect(page.chunks).not.toHaveProperty('loader');
  });
});
