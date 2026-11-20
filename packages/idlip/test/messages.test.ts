import { describe, expect, expectTypeOf, it } from 'vitest';
import { type MessageOf, createConstructors, createMessage, defineModule } from '../src/index.ts';

interface Model {
  draft: string;
  done: string[];
}

const todo = defineModule<Model>()({
  init: () => ({ draft: '', done: [] }),
  update: {
    add(m) {
      return { ...m, draft: '' };
    },
    setDraft(m, text: string) {
      return { ...m, draft: text };
    },
    toggle(m, id: string) {
      return { ...m, done: [...m.done, id] };
    },
  },
  view(m, msg) {
    return [m.draft, msg.add(), msg.setDraft('milk')];
  },
});

type Handlers = typeof todo.update;
const msg = createConstructors<Handlers>();

describe('createConstructors', () => {
  it('creates messages as plain data', () => {
    expect(msg.add()).toEqual({ t: 'add', p: undefined });
    expect(msg.setDraft('milk')).toEqual({ t: 'setDraft', p: 'milk' });
    expect(msg.toggle('a1')).toEqual({ t: 'toggle', p: 'a1' });
  });

  it('round-trips through JSON', () => {
    const message: MessageOf<Handlers> = msg.toggle('a1');
    expect(JSON.parse(JSON.stringify(message))).toEqual(message);
  });

  it('returns the same constructor for a tag', () => {
    expect(msg.toggle).toBe(msg.toggle);
  });

  it('exposes the tag on each constructor', () => {
    expect(msg.toggle.tag).toBe('toggle');
  });
});

describe('defineModule', () => {
  it('types msg in view from the handlers', () => {
    expectTypeOf(msg.add).parameters.toEqualTypeOf<[]>();
    expectTypeOf(msg.setDraft).parameters.toEqualTypeOf<[payload: string]>();
    // @ts-expect-error the payload of setDraft is a string
    msg.setDraft(1);
    // @ts-expect-error no handler has this tag
    // oxlint-disable-next-line typescript/no-unsafe-call
    msg.remove('a1');
  });

  it('keeps handlers callable from tests', () => {
    expect(todo.update.setDraft(todo.init(), 'milk')).toEqual({ draft: 'milk', done: [] });
  });
});

describe('createMessage', () => {
  it('matches the constructor output', () => {
    expect(createMessage('setDraft', 'milk')).toEqual(msg.setDraft('milk'));
  });
});
