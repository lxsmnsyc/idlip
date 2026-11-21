/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { analyze } from '../../../src/compiler/view/analyze/index.ts';

// The fixtures are stored as `.txt` so that `tsc`, the linter and the formatter skip them.
// `<name>.idlip.txt` is a `.idlip` source and `<name>.tsx.txt` is the TSX it must lower to.
const fixtures: Record<string, string | undefined> = import.meta.glob('./fixtures/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function listNames(): string[] {
  const names: string[] = [];
  for (const key of Object.keys(fixtures)) {
    const match = /^\.\/fixtures\/(.+)\.idlip\.txt$/.exec(key);
    if (match !== null) {
      names.push(match[1]);
    }
  }
  return names.sort();
}

function read(name: string): string {
  const source = fixtures[`./fixtures/${name}`];
  if (source === undefined) {
    throw new Error(`No fixture ${name}`);
  }
  return source;
}

// Each block of the grammar, with the fixture that shows it.
const BLOCKS: Record<string, { keyword: string; import: string | undefined }> = {
  'if.idlip.txt': { keyword: '#if (', import: undefined },
  'for.idlip.txt': { keyword: '#for (', import: 'For' },
  'switch.idlip.txt': { keyword: '#switch {', import: undefined },
  'try.idlip.txt': { keyword: '#try {', import: 'Try' },
  'head.idlip.txt': { keyword: '#head {', import: 'Head' },
  'listeners.idlip.txt': { keyword: '<subscribe ', import: 'Subscribe' },
};

describe('markup fixtures', () => {
  it('has a fixture for each block', () => {
    expect(listNames()).toEqual(expect.arrayContaining(['if', 'for', 'switch', 'try', 'head']));
    for (const [file, block] of Object.entries(BLOCKS)) {
      expect(read(file)).toContain(block.keyword);
    }
    expect(read('if.idlip.txt')).toContain('} #else if (');
    expect(read('if.idlip.txt')).toContain('} #else {');
    expect(read('switch.idlip.txt')).toContain('#case (');
    expect(read('switch.idlip.txt')).toContain('#default {');
    expect(read('try.idlip.txt')).toContain('#catch (error, reset)');
    expect(read('listeners.idlip.txt')).toContain('<window ');
    expect(read('listeners.idlip.txt')).toContain('<document ');
  });

  for (const name of listNames()) {
    describe(name, () => {
      it('has an expected TSX file', () => {
        expect(fixtures[`./fixtures/${name}.tsx.txt`]).toBeDefined();
      });

      it('analyzes without errors', () => {
        const result = analyze(`${name}.idlip.tsx`, read(`${name}.tsx.txt`));
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
      });

      it('never imports a block component in the source', () => {
        expect(read(`${name}.idlip.txt`)).not.toMatch(
          /import\s*\{[^}]*\b(For|Try|Head|Subscribe)\b/,
        );
      });
    });
  }

  it('adds the block imports to the TSX, after the last line of the source', () => {
    for (const [file, block] of Object.entries(BLOCKS)) {
      if (block.import === undefined) {
        continue;
      }
      const tsx = read(file.replace('.idlip.txt', '.tsx.txt'));
      expect(tsx.endsWith(`import { ${block.import} } from 'idlip';\n`)).toBe(true);
    }
  });
});
