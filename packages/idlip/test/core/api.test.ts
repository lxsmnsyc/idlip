import { describe, expect, expectTypeOf, it } from 'vitest';
import type { EventFor, EventProp } from '../../src/core/events.ts';
import type { Message } from '../../src/core/format.ts';
import { For, Head, Subscribe, Try, trusted } from '../../src/index.ts';
import type { TrustedHtml } from '../../src/index.ts';
import type TodoApp from './todo.tsx';
import type { Todo } from './todo.tsx';

// The compile-time cases live in todo.tsx, where `tsc` checks them with
// `@ts-expect-error`. This file checks the runtime values and the exported types.

describe('block components', () => {
  it('throw when called, since the compiler replaces them', () => {
    const props = { each: [], key: 'id', children: () => undefined };
    expect(() => {
      Reflect.apply(For, undefined, [props]);
    }).toThrow('<For>');
    expect(() => {
      Reflect.apply(Try, undefined, [{}]);
    }).toThrow('<Try>');
    expect(() => {
      Reflect.apply(Head, undefined, [{}]);
    }).toThrow('<Head>');
    expect(() => {
      Reflect.apply(Subscribe, undefined, [{}]);
    }).toThrow('<Subscribe>');
  });

  it('types `key` as a field of the item', () => {
    type Props = Parameters<typeof For<Todo>>[0];
    expectTypeOf<Props['key']>().toEqualTypeOf<'id' | 'text' | 'done'>();
    expectTypeOf<Props['each']>().toEqualTypeOf<readonly Todo[]>();
  });
});

describe('trusted', () => {
  it('returns the string unchanged, branded', () => {
    const html = trusted('<b>x</b>');
    expect(html).toBe('<b>x</b>');
    expectTypeOf(html).toEqualTypeOf<TrustedHtml>();
  });

  it('rejects a plain string where TrustedHtml is required', () => {
    function accept(_html: TrustedHtml): void {}
    accept(trusted('x'));
    // @ts-expect-error a plain string is not TrustedHtml
    accept('x');
  });
});

describe('event types', () => {
  it('types currentTarget as the element', () => {
    type Event = EventFor<HTMLInputElement, InputEvent>;
    expectTypeOf<Event['currentTarget']>().toExtend<HTMLInputElement>();
    expectTypeOf<Event['data']>().toEqualTypeOf<string | null>();
    expectTypeOf<Parameters<EventProp<HTMLInputElement, InputEvent>>[0]>().toEqualTypeOf<Event>();
  });
});

describe('component types', () => {
  it('takes its props as one parameter', () => {
    expectTypeOf<Parameters<typeof TodoApp>[0]>().toEqualTypeOf<{ initial: Todo[] }>();
  });
});

describe('Message', () => {
  it('is a tag and a payload', () => {
    expectTypeOf<Message<'toggle', [string]>>().toEqualTypeOf<{
      readonly t: 'toggle';
      readonly p: [string];
    }>();
  });
});
