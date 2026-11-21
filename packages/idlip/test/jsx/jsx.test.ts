import { describe, expectTypeOf, it } from 'vitest';
import type { EventFor, JSX } from 'idlip/jsx-runtime';
import type * as fixture from './fixture.tsx';

describe('jsx types', () => {
  it('types the element of currentTarget', () => {
    type Input = JSX.IntrinsicElements['input'];
    type OnInput = NonNullable<Input['on:input']>;
    type LatestInput = NonNullable<Input['latest:input']>;
    expectTypeOf<Parameters<OnInput>[0]>().toEqualTypeOf<EventFor<HTMLInputElement, InputEvent>>();
    expectTypeOf<Parameters<LatestInput>[0]>().toEqualTypeOf<
      EventFor<HTMLInputElement, InputEvent>
    >();
  });

  it('keeps window and document to event props', () => {
    expectTypeOf<keyof JSX.IntrinsicElements['window']>().toExtend<
      `on:${string}` | `latest:${string}`
    >();
    expectTypeOf<keyof JSX.IntrinsicElements['document']>().toExtend<
      `on:${string}` | `latest:${string}`
    >();
  });

  it('compiles the fixture', () => {
    expectTypeOf<typeof fixture.Ok>().returns.toExtend<JSX.Element>();
  });
});
