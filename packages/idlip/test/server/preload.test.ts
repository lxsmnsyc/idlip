import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChunkUrls, Manifest } from '../../src/core/format.ts';
import { renderPreload } from '../../src/server/index.ts';

const DIR = join(import.meta.dirname, '../fixtures/todo/expected');

function isManifest(value: unknown): value is Manifest {
  return typeof value === 'object' && value !== null && 'handlers' in value && 'groups' in value;
}

function readManifest(): Manifest {
  const parsed: unknown = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));
  if (!isManifest(parsed)) {
    throw new TypeError('bad manifest');
  }
  return parsed;
}

const manifest = readManifest();
const base = '/src/todo.tsx?idlip-';
const chunks: ChunkUrls = Object.fromEntries([
  [`${base}handler=toggle&lang.js`, '/assets/toggle.a.js'],
  [`${base}handler=add&lang.js`, '/assets/add.b.js'],
  [`${base}handler=setDraft&lang.js`, '/assets/set-draft.c.js'],
  [`${base}binding=todos.*.done&lang.js`, '/assets/done.d.js'],
  [`${base}binding=draft&lang.js`, '/assets/draft.e.js'],
  [`${base}binding=todos&lang.js`, '/assets/todos.f.js'],
]);

describe('renderPreload', () => {
  it('names the click handler and its binding chunks, and nothing else', () => {
    expect(renderPreload(chunks, manifest)).toBe(
      '<link rel="modulepreload" href="/assets/toggle.a.js">' +
        '<link rel="modulepreload" href="/assets/done.d.js">',
    );
  });

  it('names the shared helpers module first whenever it names a chunk', () => {
    const shared: ChunkUrls = { ...chunks, helpers: '/assets/_idlip-helpers.g.js' };
    expect(renderPreload(shared, manifest, { max: 1 })).toBe(
      '<link rel="modulepreload" href="/assets/_idlip-helpers.g.js">' +
        '<link rel="modulepreload" href="/assets/toggle.a.js">',
    );
    // An event with no handler names nothing, not even the helpers.
    expect(renderPreload(shared, manifest, { events: ['wheel'] })).toBe('');
  });

  it('follows the events option', () => {
    const out = renderPreload(chunks, manifest, { events: ['input'] });
    expect(out).toContain('/assets/set-draft.c.js');
    expect(out).toContain('/assets/draft.e.js');
    expect(out).not.toContain('toggle');
  });

  it('formats a Link header for Early Hints', () => {
    expect(renderPreload(chunks, manifest, { format: 'header' })).toBe(
      '</assets/toggle.a.js>; rel=modulepreload, </assets/done.d.js>; rel=modulepreload',
    );
  });

  it('caps the count', () => {
    const out = renderPreload(chunks, manifest, { max: 1 });
    expect(out).toBe('<link rel="modulepreload" href="/assets/toggle.a.js">');
  });

  it('writes the nonce and escapes the URL', () => {
    const odd: ChunkUrls = { [`${base}handler=toggle&lang.js`]: '/a"b.js?x=1&y=2' };
    expect(renderPreload(odd, manifest, { nonce: 'n1' })).toBe(
      '<link rel="modulepreload" href="/a&quot;b.js?x=1&amp;y=2" nonce="n1">',
    );
  });

  it('returns an empty string for a manifest without listens', () => {
    const bare: Manifest = { ...manifest, listens: undefined };
    expect(renderPreload(chunks, bare)).toBe('');
  });

  it('skips a handler the manifest does not know', () => {
    const odd: Manifest = { ...manifest, listens: { click: ['other'] } };
    expect(renderPreload(chunks, odd)).toBe('');
  });

  it('reads the manifests of child modules and keeps the event order under the cap', () => {
    const child: Manifest = {
      module: '/src/child.tsx',
      events: ['input'],
      listens: { input: ['edit'] },
      handlers: { edit: { chunk: 'handler=edit' } },
      groups: {},
      lists: {},
    };
    const all: ChunkUrls = {
      ...chunks,
      '/src/child.tsx?idlip-handler=edit&lang.js': '/assets/edit.g.js',
    };
    expect(renderPreload(all, [manifest, child], { events: ['input', 'click'], max: 2 })).toBe(
      '<link rel="modulepreload" href="/assets/set-draft.c.js">' +
        '<link rel="modulepreload" href="/assets/draft.e.js">',
    );
    expect(renderPreload(all, [manifest, child], { events: ['input'], max: 3 })).toContain(
      '/assets/edit.g.js',
    );
  });

  it('writes crossorigin on links and in the header', () => {
    expect(renderPreload(chunks, manifest, { max: 1, crossorigin: 'use-credentials' })).toBe(
      '<link rel="modulepreload" href="/assets/toggle.a.js" crossorigin="use-credentials">',
    );
    expect(
      renderPreload(chunks, manifest, { max: 1, format: 'header', crossorigin: 'anonymous' }),
    ).toBe('</assets/toggle.a.js>; rel=modulepreload; crossorigin');
  });
});
