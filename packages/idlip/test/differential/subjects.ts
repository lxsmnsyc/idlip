// oxlint-disable import/prefer-default-export
/** The components the differential test renders, with the props each one takes. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Subject } from './harness.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures');
const EXAMPLES = join(import.meta.dirname, '../../../../examples');

const TODOS = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build <the> runtime', done: false },
];

function read(...parts: string[]): string {
  return readFileSync(join(...parts), 'utf8');
}

export const SUBJECTS: readonly Subject[] = [
  { name: 'counter', source: read(FIXTURES, 'counter/counter.tsx'), props: { start: 3 } },
  { name: 'todo', source: read(FIXTURES, 'todo/todo.tsx'), props: { initial: TODOS } },
  { name: 'form', source: read(FIXTURES, 'form/form.tsx'), props: {} },
  { name: 'refs', source: read(FIXTURES, 'refs/refs.tsx'), props: { start: 'one' } },
  { name: 'dynamic', source: read(FIXTURES, 'dynamic/dynamic.tsx'), props: { initial: TODOS } },
  { name: 'pick', source: read(FIXTURES, 'dynamic/pick.tsx'), props: {} },
  { name: 'svg', source: read(FIXTURES, 'svg/svg.tsx'), props: { first: 'show' } },
  { name: 'raw', source: read(FIXTURES, 'svg/raw.tsx'), props: { note: '<b>note</b>' } },
  { name: 'svg-try', source: read(FIXTURES, 'svg/try.tsx'), props: { n: 3 } },
  {
    name: 'try-board',
    source: read(FIXTURES, 'try/board.tsx'),
    props: {},
    // The first row throws, and the next model makes it valid.
    pairs: (initial) => [[initial, { ...initial, items: [{ id: 1, n: 4 }] }]],
  },
  { name: 'example-todo', source: read(EXAMPLES, 'todo/src/todo.tsx'), props: { initial: TODOS } },
  {
    name: 'rich',
    source: read(import.meta.dirname, 'subjects/rich.tsx'),
    props: { title: 'Hello' },
  },
  {
    name: 'nested-board',
    source: read(FIXTURES, 'nested/board/board.tsx'),
    props: {
      items: [
        { id: 'a1', label: 'First' },
        { id: 'a2', label: 'Second' },
      ],
    },
    clicks: '[on\\:click*="remove"], [on\\:click*="clearAll"]',
    children: { '../counter/counter.tsx': read(FIXTURES, 'nested/counter/counter.tsx') },
  },
  {
    name: 'example-board',
    source: read(EXAMPLES, 'counters/src/board.tsx'),
    props: {
      items: [
        { id: 'a1', label: 'First', start: 2 },
        { id: 'a2', label: 'Second', start: 0 },
      ],
    },
    clicks: '[on\\:click*="remove"]',
    children: { './counter.tsx': read(EXAMPLES, 'counters/src/counter.tsx') },
  },
  {
    name: 'parent',
    source: read(import.meta.dirname, 'subjects/parent.tsx'),
    props: { items: [{ id: 'a1', label: 'First' }] },
    clicks:
      '[on\\:click*="add"], [on\\:click*="relabel"], [on\\:click*="reverse"], [on\\:click*="toggle"], [on\\:click*="rename"], [on\\:click*="remove"]',
    children: { './counter.tsx': read(import.meta.dirname, 'subjects/counter.tsx') },
  },
  {
    name: 'example-board-subs',
    source: read(EXAMPLES, 'counters-subs/src/board.tsx'),
    props: {
      items: [
        { id: 'a1', label: 'First', start: 2 },
        { id: 'a2', label: 'Second', start: 0 },
      ],
    },
    clicks: '[on\\:click*="remove"]',
    children: { './counter.tsx': read(EXAMPLES, 'counters-subs/src/counter.tsx') },
  },
];
