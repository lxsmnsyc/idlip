// @vitest-environment happy-dom
// oxlint-disable typescript/no-unsafe-type-assertion
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { renderListener } from '../../../src/client/loader/listener.ts';
import type { Boot, PageState } from '../../../src/core/format.ts';
import { installListener } from './helpers.ts';

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

const STATE = (() => ({})) as unknown as () => PageState;

/** Puts markup in the page, installs the listener and pushes a record for `events`. */
function page(html: string, events: string): Boot {
  document.body.innerHTML = html;
  const listener = installListener();
  cleanup = listener.cleanup;
  listener.boot.push([events, STATE]);
  return listener.boot;
}

function messages(boot: Boot): unknown[] {
  const found: unknown[] = [];
  for (const event of boot.q!) {
    found.push(event.message);
  }
  return found;
}

function fire(el: Element, event: Event): Event {
  el.dispatchEvent(event);
  return event;
}

function click(): Event {
  return new Event('click', { bubbles: true, cancelable: true });
}

function key(name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: name, ...init });
}

describe('renderListener', () => {
  it('returns one script tag, with a nonce when given', () => {
    expect(renderListener()).toMatch(/^<script>[\s\S]*<\/script>$/);
    expect(renderListener().slice(0, -9)).not.toContain('</script');
    expect(renderListener({ nonce: 'a"b' })).toMatch(/^<script nonce="a&quot;b">/);
  });

  it('stays within 1024 B gzip', () => {
    const script = /<script>([\s\S]*)<\/script>/.exec(renderListener())![1];
    expect(gzipSync(script, { level: 9 }).length).toBeLessThanOrEqual(1024);
  });
});

describe('delegation', () => {
  it('picks up records pushed before the listener ran', () => {
    document.body.innerHTML = '<button on:click=\'["go",[]]\'>x</button>';
    const listener = installListener(undefined, [['click', STATE]]);
    cleanup = listener.cleanup;
    document.querySelector('button')!.click();
    expect(messages(listener.boot)).toEqual([{ t: 'go', p: [] }]);
  });

  it('resolves $event paths, currentTarget and the $ literal', () => {
    const boot = page(
      `<input id="f" on:input='["set",[["$event","currentTarget","value"],["$event","target","id"],["$event","type"],["$","$a",1]]]'>`,
      'input',
    );
    const el = document.querySelector('input')!;
    el.value = 'v';
    fire(el, new Event('input', { bubbles: true }));
    expect(messages(boot)).toEqual([{ t: 'set', p: ['v', 'f', 'input', ['$a', 1]] }]);
  });

  it('walks outwards and fires each element, and stop ends the walk', () => {
    const boot = page(
      `<div on:click='["outer",[]]'><p on:click='["mid",[],"stop"]'><b on:click='["inner",[]]'>x</b></p></div>`,
      'click',
    );
    document.querySelector('b')!.click();
    expect(messages(boot)).toEqual([
      { t: 'inner', p: [] },
      { t: 'mid', p: [] },
    ]);
  });

  it('runs capture elements outermost first, before the others', () => {
    const boot = page(
      `<div on:click='["a",[],"capture"]'><p on:click='["b",[]]'><b on:click='["c",[],"capture"]'>x</b></p></div>`,
      'click',
    );
    document.querySelector('b')!.click();
    expect(messages(boot)).toEqual([
      { t: 'a', p: [] },
      { t: 'c', p: [] },
      { t: 'b', p: [] },
    ]);
  });

  it('applies prevent, but not with passive', () => {
    const boot = page(
      `<a on:click='["go",[],"prevent"]'>x</a><i on:click='["go",[],"passive"]'>y</i>`,
      'click',
    );
    expect(fire(document.querySelector('a')!, click()).defaultPrevented).toBe(true);
    expect(fire(document.querySelector('i')!, click()).defaultPrevented).toBe(false);
    expect(boot.q).toHaveLength(2);
  });

  it('removes the attribute after the first message with once', () => {
    const boot = page(`<button on:click='["go",[],"once"]'>x</button>`, 'click');
    const button = document.querySelector('button')!;
    button.click();
    button.click();
    expect(boot.q).toHaveLength(1);
    expect(button.hasAttribute('on:click')).toBe(false);
  });

  it('marks latest events', () => {
    const boot = page(`<input on:input='["go",[],"latest"]'>`, 'input');
    fire(document.querySelector('input')!, new Event('input', { bubbles: true }));
    expect(boot.q![0].latest).toBe(true);
  });

  it('matches non-bubbling events on the target only', () => {
    const boot = page(
      `<div on:focus='["outer",[]]'><input on:focus='["inner",[]]'><button>b</button></div>`,
      'focus',
    );
    fire(document.querySelector('input')!, new FocusEvent('focus'));
    fire(document.querySelector('button')!, new FocusEvent('focus'));
    expect(messages(boot)).toEqual([{ t: 'inner', p: [] }]);
  });

  it('fires blur through delegation', () => {
    const boot = page(`<input on:blur='["left",[]]'>`, 'blur');
    fire(document.querySelector('input')!, new FocusEvent('blur'));
    expect(messages(boot)).toEqual([{ t: 'left', p: [] }]);
  });

  it('listens on window and document for i-global templates', () => {
    const boot = page(
      `<template i-global="window" on:keydown='["w",[]]'></template><template i-global="document" on:keydown='["d",[]]'></template>`,
      'keydown:window keydown:document',
    );
    fire(document.body, key('a'));
    expect(messages(boot)).toEqual([
      { t: 'd', p: [] },
      { t: 'w', p: [] },
    ]);
  });

  it('adds no window or document listener for a type no global element uses', () => {
    document.body.innerHTML = `<div on:pointermove='["s",[]]'></div>`;
    const listener = installListener();
    cleanup = listener.cleanup;
    listener.boot.push(['pointermove', STATE]);
    // Only the capture and bubble listeners on document, none with the default options.
    const plain = listener.calls.filter((call) => call.options === undefined);
    expect(plain).toEqual([]);
  });

  it('adds a non-passive listener when a later record needs one for the same type', () => {
    document.body.innerHTML = `<div on:wheel='["s",[],"passive"]'></div>`;
    const listener = installListener();
    cleanup = listener.cleanup;
    listener.boot.push(['wheel:passive', STATE]);
    listener.boot.push(['wheel', STATE]);
    const wheel = listener.calls.filter((call) => call.type === 'wheel');
    expect(wheel.map((call) => (call.options as { passive: boolean }).passive)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    // The passive listener is gone, so one event gives one message.
    fire(document.querySelector('div')!, new Event('wheel', { bubbles: true }));
    expect(listener.boot.q).toHaveLength(1);
  });

  it('stops other handlers of the event with stop', () => {
    const boot = page(`<button on:click='["go",[],"stop"]'>x</button>`, 'click');
    let seen = false;
    document.addEventListener('click', () => {
      seen = true;
    });
    document.querySelector('button')!.click();
    expect(boot.q).toHaveLength(1);
    expect(seen).toBe(false);
  });

  it.each(['toggle', 'close', 'play', 'timeupdate', 'loadedmetadata'])(
    'matches %s on the target only',
    (type) => {
      const boot = page(
        `<div on:${type}='["outer",[]]'><span on:${type}='["inner",[]]'><b></b></span></div>`,
        type,
      );
      fire(document.querySelector('b')!, new Event(type));
      expect(boot.q).toHaveLength(0);
      fire(document.querySelector('span')!, new Event(type));
      expect(messages(boot)).toEqual([{ t: 'inner', p: [] }]);
    },
  );

  it('resolves currentTarget to window or document for a global template', () => {
    const boot = page(
      `<template i-global="window" on:keydown='["w",[["$event","currentTarget","name"]]]'></template>`,
      'keydown:window keydown:document',
    );
    (window as { name: string }).name = 'win';
    fire(document.body, key('a'));
    expect(messages(boot)).toEqual([{ t: 'w', p: ['win'] }]);
  });

  it('adds a passive listener for a type marked passive', () => {
    const boot = page(`<div on:scroll='["s",[]]'></div>`, 'scroll:passive');
    fire(document.querySelector('div')!, new Event('scroll'));
    expect(messages(boot)).toEqual([{ t: 's', p: [] }]);
  });
});

describe('key filters', () => {
  const FILTERS: [string, KeyboardEventInit & { key: string }, boolean][] = [
    ['Escape', { key: 'Escape' }, true],
    ['Escape', { key: 'Enter' }, false],
    ['Enter', { key: 'Enter', shiftKey: true }, true],
    ['Ctrl+s', { key: 's', ctrlKey: true }, true],
    ['Ctrl+s', { key: 'S', ctrlKey: true }, true],
    ['Ctrl+s', { key: 's' }, false],
    ['Ctrl+Shift+z', { key: 'z', ctrlKey: true }, false],
    ['Ctrl+Shift+z', { key: 'z', ctrlKey: true, shiftKey: true }, true],
    ['Alt+Meta+x', { key: 'x', altKey: true, metaKey: true }, true],
    ['Mod+k', { key: 'k', ctrlKey: true }, true],
    ['Mod+k', { key: 'k' }, false],
    ['Ctrl++', { key: '+', ctrlKey: true }, true],
  ];

  for (const [filter, init, matches] of FILTERS) {
    it(`${filter} ${matches ? 'matches' : 'ignores'} ${JSON.stringify(init)}`, () => {
      const boot = page(`<input on:keydown='["go",[],"prevent key:${filter}"]'>`, 'keydown');
      const event = fire(document.querySelector('input')!, key(init.key, init));
      expect(boot.q!.length).toBe(matches ? 1 : 0);
      // The filter is checked before every other modifier.
      expect(event.defaultPrevented).toBe(matches);
    });
  }
});
