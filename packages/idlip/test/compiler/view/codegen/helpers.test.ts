import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../../../src/compiler/view/analyze/index.ts';
import { generate } from '../../../../src/compiler/view/codegen/index.ts';
import type { GenerateResult } from '../../../../src/compiler/view/codegen/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const FIXTURES = join(ROOT, 'test', 'fixtures');

/** Lists the names `src/client/index.ts` exports, the ones a chunk may import. */
function readLoaderExports(): Set<string> {
  const file = join(ROOT, 'src', 'client', 'index.ts');
  const program = parseSync(file, readFileSync(file, 'utf8')).program;
  const names = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      names.add(specifier.exported.type === 'Identifier' ? specifier.exported.name : '');
    }
    const declaration = statement.declaration;
    if (declaration?.type === 'VariableDeclaration') {
      for (const item of declaration.declarations) {
        if (item.id.type === 'Identifier') {
          names.add(item.id.name);
        }
      }
    }
  }
  return names;
}

/** Lists the names a chunk imports from `idlip/client`. */
function readClientImports(code: string): string[] {
  const names: string[] = [];
  for (const match of code.matchAll(/import \{([^}]*)\} from 'idlip\/client'/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(' as ')[0];
      if (name !== '') {
        names.push(name);
      }
    }
  }
  return names;
}

function generateFixture(name: string): GenerateResult {
  const file = `${name}.idlip.tsx`;
  const source = readFileSync(join(FIXTURES, name, file), 'utf8');
  return generate(analyze(file, source), source, `/src/${file}`);
}

const BRANCH = `
  export default function App() {
    let open = false;
    function toggle() {
      open = !open;
    }
    return (
      <div on:click={toggle} title={open ? 'a' : 'b'}>
        {open ? <p>yes</p> : <p>no</p>}
        <span>{open}</span>
      </div>
    );
  }
`;

describe('chunk imports', () => {
  it('import only what the loader exports', () => {
    const loader = readLoaderExports();
    const results = [
      generateFixture('counter'),
      generateFixture('todo'),
      generate(analyze('branch.idlip.tsx', BRANCH), BRANCH, '/src/branch.idlip.tsx'),
    ];
    const missing: string[] = [];
    for (const result of results) {
      for (const module of result.client) {
        for (const name of readClientImports(module.code)) {
          if (!loader.has(name)) {
            missing.push(`${module.chunk}: ${name}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('reserved names', () => {
  function run(source: string): GenerateResult {
    return generate(analyze('clash.idlip.tsx', source), source, '/src/clash.idlip.tsx');
  }

  it('reports a module-level function named like a generated helper', () => {
    const result = run(`
      function getText$(value: number): string {
        return String(value);
      }
      export default function App() {
        let n = 1;
        function bump() {
          n = n + 1;
        }
        return <button on:click={bump}>{getText$(n)}</button>;
      }
    `);
    const errors = result.diagnostics.filter((item) => item.rule === 'module-reserved-name');
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('error');
    expect(errors[0].message).toContain('getText$');
    expect(result.server).toBe('');
  });

  it('reports an import named like a generated helper', () => {
    const result = run(`
      import { text$ } from './streams';
      export default function App() {
        let n = 1;
        function bump() {
          n = n + 1;
        }
        return <button on:click={bump}>{text$(n)}</button>;
      }
    `);
    const errors = result.diagnostics.filter((item) => item.rule === 'module-reserved-name');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('text$');
  });
});
