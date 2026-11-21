// @vitest-environment happy-dom
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { getChunkFile } from '../../src/core/format.ts';
import { listChunks } from '../../src/vite/chunks.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures');
const BOARD = readFileSync(join(FIXTURES, 'try/board.idlip.tsx'), 'utf8');
const EXPECTED = join(FIXTURES, 'try/expected');
const ID = '/src/board.idlip.tsx';

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

function readExpected(...parts: string[]): string {
  return readFileSync(join(EXPECTED, ...parts), 'utf8');
}

function getErrors(source: string): string[] {
  const rules: string[] = [];
  for (const item of compile(source, ID).diagnostics) {
    if (item.severity === 'error') {
      rules.push(item.rule);
    }
  }
  return rules;
}

describe('golden files', () => {
  const result = compile(BOARD, ID);

  // `UPDATE_TRY=1 pnpm vitest run test/try` writes the files again, except page.html.
  if (process.env.UPDATE_TRY === '1') {
    it('writes the golden files', () => {
      rmSync(join(EXPECTED, 'client'), { recursive: true, force: true });
      mkdirSync(join(EXPECTED, 'client'), { recursive: true });
      writeFileSync(join(EXPECTED, 'server.js'), result.server);
      writeFileSync(
        join(EXPECTED, 'manifest.json'),
        `${JSON.stringify(result.manifest, null, 2)}\n`,
      );
      for (const chunk of result.client) {
        writeFileSync(join(EXPECTED, 'client', getChunkFile(chunk.chunk)), chunk.code);
      }
    });
  }

  it('has no errors', () => {
    expect(getErrors(BOARD)).toEqual([]);
  });

  it('matches the server module and the manifest', () => {
    expect(result.server).toBe(readExpected('server.js'));
    expect(result.manifest).toEqual(JSON.parse(readExpected('manifest.json')));
  });

  it('matches every client chunk', () => {
    for (const chunk of result.client) {
      expect(chunk.code, chunk.chunk).toBe(readExpected('client', getChunkFile(chunk.chunk)));
    }
  });

  it('names one fallback chunk per region and lists it', () => {
    expect(result.manifest.fallback).toEqual({ 0: 'try=0', 1: 'try=1', 2: 'try=2' });
    const names = listChunks(result.manifest);
    expect(names).toEqual(expect.arrayContaining(['try=0', 'try=1', 'try=2']));
    const built = new Set<string>();
    for (const chunk of result.client) {
      built.add(chunk.chunk);
    }
    for (const name of names) {
      expect(built.has(name), name).toBe(true);
    }
  });
});

describe('server render', () => {
  it('renders the catch view where a hole throws', async () => {
    page = await mount(BOARD, { id: ID });
    expect(page.text('p')).toContain('Failed: Error: bad -1');
    // A region that does not throw renders its body, in state 0.
    expect(page.text('b')).toBe('3');
    expect(page.root.innerHTML).toContain('<!--e1:0--><b>3</b><!--/e-->');
    expect(page.root.innerHTML).toContain('<!--e0:1-->');
  });

  it('renders a region in a row, and the other rows stay ok', async () => {
    page = await mount(BOARD, { id: ID });
    const rows = page.root.querySelectorAll('li');
    expect(rows[0].textContent).toBe('Error: bad -1');
    expect(rows[1].textContent).toBe('2');
    expect(rows[0].innerHTML).toContain('<!--e2:1-->');
    expect(rows[1].innerHTML).toContain('<!--e2:0-->');
  });

  it('writes the reset message with the region id', async () => {
    page = await mount(BOARD, { id: ID });
    expect(page.get('p button').getAttribute('on:click')).toBe('["$reset",[0]]');
    expect(page.get('li button').getAttribute('on:click')).toBe('["$reset",[2]]');
  });

  it('renders the same region from the client template of a branch', async () => {
    page = await mount(BOARD, { id: ID });
    page.click('main > button:last-child');
    await page.settled();
    expect(page.root.querySelector('i')?.textContent).toBe('hidden');
    page.click('main > button:last-child');
    await page.settled();
    expect(page.text('b')).toBe('3');
    expect(page.root.innerHTML).toContain('<!--e1:0--><b>3</b><!--/e-->');
  });
});

describe('compile', () => {
  it('writes no fallback and no region marker for a module without <Try>', () => {
    const result = compile(
      'export default function App() { let n = 0; function inc() { n = n + 1; } return <button on:click={inc}>{n}</button>; }',
      '/src/app.idlip.tsx',
    );
    expect(result.manifest.fallback).toBeUndefined();
    expect(result.server).not.toContain('<!--e');
    expect(result.server).not.toContain('try');
  });

  it('rejects a block in the catch view', () => {
    const source = BOARD.replace(
      'catch={(error) => <em>{error}</em>}',
      'catch={(error) => <ul><For each={items} key="id">{(item) => <li>{item.n}</li>}</For></ul>}',
    );
    expect(getErrors(source)).toContain('try-catch-node');
  });
});
