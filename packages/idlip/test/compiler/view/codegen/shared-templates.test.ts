import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';
import type { Module } from '../../../../src/core/format.ts';

const SOURCE = `import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
export default function List(): JSX.Element {
  let items = [{ id: 'a', label: 'One' }];
  return (
    <ul>
      <For each={items} key={(item) => item.id}>
        {(item) => <li class="row"><b>{item.label}</b></li>}
      </For>
    </ul>
  );
}
`;

function findRowChunk(shared?: ReadonlySet<string>): Module {
  const result = compile(SOURCE, '/src/list.tsx', shared === undefined ? {} : { shared });
  for (const module of result.client) {
    if (module.chunk.startsWith('list=')) {
      return module;
    }
  }
  throw new Error('The list has no chunk');
}

function listHashes(source: string, id: string): string[] {
  const hashes: string[] = [];
  for (const module of compile(source, id).client) {
    for (const template of module.templates ?? []) {
      hashes.push(template.hash);
    }
  }
  return hashes;
}

describe('shared templates', () => {
  it('declares a template in the chunk and reports its hash', () => {
    const chunk = findRowChunk();
    expect(chunk.code).toMatch(/const templateL\d+\$ = \{ h: /);
    expect(chunk.code).not.toContain('idlip/templates');
    expect(chunk.templates?.length).toBeGreaterThan(0);
  });

  it('imports a shared template from the templates module', () => {
    const [first] = findRowChunk().templates ?? [];
    const chunk = findRowChunk(new Set([first.hash]));
    expect(chunk.code).toContain(`import { t${first.hash} as templateL`);
    expect(chunk.code).toContain("from 'idlip/templates';");
    expect(chunk.code).not.toMatch(/const templateL\d+\$ = /);
  });

  it('gives equal markup the same hash in two components', () => {
    const other = SOURCE.replace('List()', 'Other()');
    expect(listHashes(SOURCE, '/src/a.tsx')).toEqual(listHashes(other, '/src/b.tsx'));
  });
});
