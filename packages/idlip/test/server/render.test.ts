import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import type { PageState, RenderContext } from '../../src/core/format.ts';
import { attr, on, render, text } from '../../src/server/index.ts';

// Compiled fixture modules import the helpers from the package. Point them at this source.
vi.mock('idlip/server', async () => import('../../src/server/index.ts'));

const FIXTURES = join(import.meta.dirname, '../fixtures');

interface Input {
  props: unknown;
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function isComponent(value: unknown): value is (props: unknown) => unknown {
  return typeof value === 'function';
}

function isInput(value: unknown): value is Input {
  return typeof value === 'object' && value !== null && 'props' in value;
}

for (const name of ['counter', 'todo']) {
  describe(`fixture ${name}`, () => {
    it('renders the fixture page', async () => {
      const dir = join(FIXTURES, name);
      const input: unknown = JSON.parse(readText(join(dir, 'input.json')));
      if (!isInput(input)) {
        throw new TypeError('bad input');
      }
      const mod: unknown = await import(join(dir, 'expected/server.js'));
      const component: unknown = Reflect.get(Object(mod), 'default');
      if (!isComponent(component)) {
        throw new TypeError('bad module');
      }
      const html = await render(component, input.props);
      expect(html).toBe(readText(join(dir, 'expected/page.html')).trimEnd());
    });
  });
}

function makeComponent(model: Record<string, unknown>) {
  return (_props: unknown, context?: RenderContext): string => {
    const state: PageState = {
      manifest: { module: '/m', events: ['click'], handlers: {}, groups: {}, lists: {} },
      chunks: {},
      model,
      props: {},
    };
    context?.state(state);
    return `<p>${text(model.s)}</p><i${attr('title', model.s)}></i>`;
  };
}

describe('escaping', () => {
  const hostile = ['</script><!--', '"q"', String.fromCodePoint(0x2028), "& '"].join(' ');

  it('escapes text, attributes and events', () => {
    expect(text('<a>&')).toBe('&lt;a&gt;&amp;');
    expect(attr('title', 'a"&b')).toBe(' title="a&quot;&amp;b"');
    expect(text(null)).toBe('');
    expect(attr('disabled', true)).toBe(' disabled');
    expect(attr('hidden', false)).toBe('');
    expect(attr('class', { a: true, b: 0, c: 1 })).toBe(' class="a c"');
    expect(on('click', ['t', ["it's & <"]])).toBe(` on:click='["t",["it&#39;s &amp; <"]]'`);
  });

  it('keeps a hostile model string from ending the script or the markup', async () => {
    const html = await render(makeComponent({ s: hostile }), {});
    const [markup = '', script = ''] = html.split('<script i-state>');
    // Text escapes `<`. The attribute escapes `"`, so `<` inside its quotes is inert.
    expect(markup).toContain('<p>&lt;/script&gt;&lt;!-- "q"');
    expect(markup).toContain('title="</script><!-- &quot;q&quot;');
    // One closing tag, at the end.
    expect(script.indexOf('</script>')).toBe(script.length - '</script>'.length);
    expect(script).not.toContain('<!--');
    expect(script).not.toContain(String.fromCodePoint(0x2028));
    expect(script).toContain(String.raw`\x3C`);
    // The decoded state round-trips.
    const pushed: unknown[] = [];
    const self = { $idlip: { push: (record: unknown) => pushed.push(record) } };
    runInNewContext(script.replace('</script>', ''), { self });
    const [record] = pushed;
    const decode: unknown = Array.isArray(record) ? record[1] : undefined;
    if (typeof decode !== 'function') {
      throw new TypeError('bad record');
    }
    expect(Reflect.get(Object(record), 0)).toBe('click');
    expect(Reflect.apply(decode, undefined, [])).toMatchObject({ model: { s: hostile } });
  });
});

describe('nonce', () => {
  it('is written on the state script', async () => {
    const html = await render(makeComponent({ s: 'x' }), {}, { nonce: 'n"1' });
    expect(html).toContain('<script i-state nonce="n&quot;1">');
  });

  it('is absent by default', async () => {
    expect(await render(makeComponent({ s: 'x' }), {})).toContain('<script i-state>');
  });
});

describe('state', () => {
  it('requires the component to record its state', async () => {
    await expect(render(() => '', {})).rejects.toThrow('recorded no state');
  });
});

describe('state values', () => {
  function recordState(model: Record<string, unknown>, props: Record<string, unknown> = {}) {
    return (_props: unknown, context?: RenderContext): string => {
      context?.state({
        manifest: { module: '/m', events: ['click'], handlers: {}, groups: {}, lists: {} },
        chunks: {},
        model,
        props,
      });
      return '';
    };
  }

  it('does not write the stack of an Error', async () => {
    const html = await render(recordState({ error: new Error('boom') }), {});
    expect(html).toContain('boom');
    expect(html).not.toContain('stack');
    expect(html).not.toContain('node_modules');
  });

  it('names the model path of a value that does not serialize', async () => {
    const model = { todos: [{ id: 'a', ref: Symbol('x') }] };
    await expect(render(recordState(model), {})).rejects.toThrow('`model.todos.0.ref`');
    await expect(render(recordState({ url: new URL('http://a') }), {})).rejects.toThrow(
      '`model.url`',
    );
  });

  it('names the props path', async () => {
    const props = { deep: { p: Promise.resolve() } };
    await expect(render(recordState({}, props), {})).rejects.toThrow('`props.deep.p`');
  });

  it('escapes a hostile class key and a hostile event payload', () => {
    expect(attr('class', { 'a" onload="x': true })).toBe(' class="a&quot; onload=&quot;x"');
    expect(on('click', ['t', ["' onmouseover='x", '&#39;']])).toBe(
      ` on:click='["t",["&#39; onmouseover=&#39;x","&amp;#39;"]]'`,
    );
  });
});
