import { describe, expect, it } from 'vitest';
import type { DemoData, DemoFile } from '../src/demo/data.ts';
import { fillPlaceholders, listSizes } from '../src/placeholders.ts';

function makeFile(raw: number, gzip: number): DemoFile {
  return { path: '', name: '', raw, gzip };
}

const DEMO: DemoData = {
  frame: 'demo/',
  document: makeFile(5000, 2000),
  listener: makeFile(1700, 990),
  loader: makeFile(10_000, 4000),
  handler: makeFile(260, 210),
  binding: makeFile(470, 290),
  helpers: makeFile(2900, 1360),
  chunks: [],
  handlerName: 'toggle',
  site: '$e3',
  token: '',
  writes: [],
  row: '',
  state: '',
  todos: [],
};

describe('fillPlaceholders', () => {
  it('writes the measured size of a file', () => {
    const text = fillPlaceholders('{{demo.loader.raw}} and {{demo.loader.gzip}}', 'a.md', DEMO);
    expect(text).toBe('10000 B and 4000 B');
  });

  it('adds the totals of the two request tables', () => {
    const sizes = listSizes(DEMO);
    expect(sizes.get('demo.load.raw')).toBe('15000 B');
    expect(sizes.get('demo.load.gzip')).toBe('6000 B');
    expect(sizes.get('demo.click.raw')).toBe('3630 B');
    expect(sizes.get('demo.click.gzip')).toBe('1860 B');
  });

  it('fails on a name it does not know', () => {
    expect(() => fillPlaceholders('{{demo.loader.size}}', 'a.md', DEMO)).toThrow(
      /a\.md: unknown placeholder \{\{demo\.loader\.size\}\}/,
    );
  });

  it('checks the names without a demo build', () => {
    expect(fillPlaceholders('{{demo.loader.raw}}', 'a.md')).toBe('n/a');
    expect(() => fillPlaceholders('{{demo.nope.raw}}', 'a.md')).toThrow(/unknown placeholder/);
  });

  it('leaves the braces of a JSX object alone', () => {
    const code = '<main class={{ dark }}>';
    expect(fillPlaceholders(code, 'a.md', DEMO)).toBe(code);
  });
});
