import { runInThisContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../../../src/compiler/view/analyze/index.ts';
import { generate } from '../../../../src/compiler/view/codegen/index.ts';
import { attr, createContext, on, text } from '../../../fixtures/reference.ts';

type Render = (props: unknown, context: unknown) => string;

function isRender(value: unknown): value is Render {
  return typeof value === 'function';
}

/** Compiles a module and renders its server code with the reference helpers. */
function renderModule(source: string): string {
  const result = generate(analyze('test.tsx', source), source, '/src/test.tsx');
  const body = result.server
    .replaceAll(/^import .*$/gm, '')
    .replace('export default function', 'function')
    .replaceAll('export const', 'const')
    .replaceAll('export function', 'function');
  const name = /function (\w+)\(props, context, model\)/.exec(body)?.[1] ?? '';
  const factory: unknown = runInThisContext(
    `(function (text$, attr$, on$) {\n${body}\nreturn ${name};\n})`,
  );
  if (typeof factory !== 'function') {
    throw new TypeError('The code is not a function');
  }
  const render: unknown = Reflect.apply(factory, undefined, [text, attr, on]);
  if (!isRender(render)) {
    throw new TypeError('The server module has no render function');
  }
  const { context } = createContext();
  return render({}, context);
}

describe('generated locals', () => {
  it('keeps a state named rows apart from the list accumulator', () => {
    const html = renderModule(`
      import { For } from 'idlip';
      export default function App() {
        let rows = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
        return (
          <ul>
            <For each={rows} key="id">{(row) => <li>{row.label}</li>}</For>
          </ul>
        );
      }
    `);
    expect(html.replaceAll(/<!--.*?-->/g, '')).toBe('<ul><li>A</li><li>B</li></ul>');
  });

  it('keeps state named like other generated locals apart', () => {
    const html = renderModule(`
      export default function App() {
        let path = 'p';
        let out = 'o';
        let el = 'e';
        let start = 's';
        let branch = 'b';
        let rows$ = 'r';
        let text$ = 't';
        return <p>{path}{out}{el}{start}{branch}{rows$}{text$}</p>;
      }
    `);
    expect(html.replaceAll(/<!--.*?-->/g, '')).toBe('<p>poesbrt</p>');
  });
});
