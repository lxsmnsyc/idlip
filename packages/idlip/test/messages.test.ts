import { describe, expect, it } from 'vitest';
import { type MessageOf, createMessage, defineMessages } from '../src/index.ts';

interface Spec {
  add: undefined;
  setDraft: string;
  toggle: { id: string };
}

const msg = defineMessages<Spec>();

describe('defineMessages', () => {
  it('creates messages as plain data', () => {
    expect(msg.add()).toEqual({ t: 'add', p: undefined });
    expect(msg.setDraft('milk')).toEqual({ t: 'setDraft', p: 'milk' });
    expect(msg.toggle({ id: 'a1' })).toEqual({ t: 'toggle', p: { id: 'a1' } });
  });

  it('round-trips through JSON', () => {
    const message: MessageOf<Spec> = msg.toggle({ id: 'a1' });
    expect(JSON.parse(JSON.stringify(message))).toEqual(message);
  });

  it('returns the same constructor for a tag', () => {
    expect(msg.toggle).toBe(msg.toggle);
  });
});

describe('createMessage', () => {
  it('matches the constructor output', () => {
    expect(createMessage('setDraft', 'milk')).toEqual(msg.setDraft('milk'));
  });
});
