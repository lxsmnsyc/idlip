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
    // A default export with a named and a private child in the same file.
    name: 'widgets',
    source: read(FIXTURES, 'widgets/widgets.tsx'),
    props: {
      items: [
        { id: 'a1', label: 'One' },
        { id: 'a2', label: 'Two' },
      ],
    },
  },
  {
    name: 'rich',
    source: read(import.meta.dirname, 'subjects/rich.tsx'),
    props: { title: 'Hello' },
  },
  {
    // Keys that are a template literal and a nested field, so rows move through the list
    // chunk's `key` and the write sets are `*`.
    name: 'computed-key',
    source: read(import.meta.dirname, 'subjects/computed-key.tsx'),
    props: {
      entries: [
        { kind: 'a', id: 1, label: 'One', done: false, meta: { id: 'm1' } },
        { kind: 'b', id: 1, label: 'Two', done: true, meta: { id: 'm2' } },
      ],
    },
  },
  {
    // Rows and branches that render by a cloned template.
    name: 'cloned',
    source: read(import.meta.dirname, 'subjects/cloned.tsx'),
    props: {
      items: [
        { id: 'a1', label: 'One', url: '/one', done: false, n: 1 },
        // oxlint-disable-next-line no-script-url
        { id: 'a2', label: '', url: 'javascript:alert(1)', done: true, n: 0 },
      ],
    },
  },
  {
    // Conditions and lists inside cloned rows and branches.
    name: 'nested-blocks',
    source: read(import.meta.dirname, 'subjects/nested-blocks.tsx'),
    props: {
      mark: true,
      groups: [
        {
          id: 'g1',
          name: 'First',
          hot: true,
          tags: [
            { id: 't1', label: 'x', on: true },
            { id: 't2', label: '<y>', on: false },
          ],
        },
        { id: 'g2', name: 'Second', hot: false, tags: [] },
      ],
    },
  },
  {
    // The condition that reads only props takes its empty branch: the clone removes its placeholder.
    name: 'nested-blocks-unmarked',
    source: read(import.meta.dirname, 'subjects/nested-blocks.tsx'),
    props: { mark: false, groups: [{ id: 'g1', name: 'First', hot: true, tags: [] }] },
  },
  {
    // Rows and branches in SVG and MathML that clone in their namespace.
    name: 'foreign',
    source: read(import.meta.dirname, 'subjects/foreign.tsx'),
    props: { title: 'Dots & <lines>' },
  },
  {
    // Holes in raw text and newline elements of cloned rows.
    name: 'raw-text',
    source: read(import.meta.dirname, 'subjects/raw-text.tsx'),
    props: { lead: '\n<lead> & "q"', rest: '> b { color: red }' },
    pairs: (initial) => [
      [initial, { ...initial, items: [{ id: 'a3', label: '\n\nthird' }] }],
      [{ ...initial, items: [] }, initial],
    ],
  },
  {
    // Text holes directly in a select, and table rows, in cloned bodies.
    name: 'select-text',
    source: read(import.meta.dirname, 'subjects/select-text.tsx'),
    props: {
      items: [
        { id: 'a1', label: 'One' },
        { id: 'a2', label: '<two>' },
      ],
    },
  },
  {
    // `<Subscribe>`, `<Try>`, a global listener and a `<template>` in cloned bodies.
    name: 'block-kinds',
    source: read(import.meta.dirname, 'subjects/block-kinds.tsx'),
    props: {
      items: [
        { id: 'a1', n: 1 },
        { id: 'a2', n: -1 },
      ],
    },
  },
  {
    // Static rows, branches and catch views, which clone with no writes.
    name: 'static-bodies',
    source: read(import.meta.dirname, 'subjects/static-bodies.tsx'),
    props: {
      items: [
        { id: 'a1', on: true },
        { id: 'a2', on: false },
      ],
    },
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
    children: { './counter.tsx': read(EXAMPLES, 'counters/src/counter.tsx') },
  },
  {
    name: 'parent',
    source: read(import.meta.dirname, 'subjects/parent.tsx'),
    props: { items: [{ id: 'a1', label: 'First' }] },
    children: { './counter.tsx': read(import.meta.dirname, 'subjects/counter.tsx') },
  },
  {
    // Children in cloned rows and branches, with a child view that clones blocks.
    name: 'cloned-children',
    source: read(import.meta.dirname, 'subjects/cloned-children.tsx'),
    props: {
      items: [
        { id: 'a1', label: 'First', on: true },
        { id: 'a2', label: 'Second', on: false },
      ],
    },
    children: { './tally.tsx': read(import.meta.dirname, 'subjects/tally.tsx') },
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
    children: { './counter.tsx': read(EXAMPLES, 'counters-subs/src/counter.tsx') },
  },
];
