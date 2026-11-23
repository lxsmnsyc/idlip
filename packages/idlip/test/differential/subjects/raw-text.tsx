// Holes in elements whose text the parser reads its own way, inside cloned rows: a `pre` that
// starts with unbound holes (the parser drops its first newline), one with a bound hole, a
// textarea whose text holds `<`, `&` and quotes, and raw HTML in a `pre` whose value starts with
// a newline. The compiler rejects a hole in a `script` or a `style`, more than one in a
// textarea, and a `title` outside `<Head>`.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, prefer-const
import { For, trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  label: string;
}

export default function RawText(props: { lead: string; rest: string }): JSX.Element {
  let items = [
    { id: 'a1', label: '\nfirst' },
    { id: 'a2', label: 'second' },
  ] satisfies Item[] as Item[];

  return (
    <ul>
      <For each={items} key={(item) => item.id}>
        {(item) => (
          <li>
            <pre>
              {props.lead}
              {props.rest} <b>{item.label}</b>
            </pre>
            <pre>{item.label}</pre>
            <pre>{props.lead}</pre>
            <pre html={trusted(`${props.lead}<b>${item.id}</b>`)} />
            <textarea>{props.lead}</textarea>
            <span>{item.label}</span>
          </li>
        )}
      </For>
    </ul>
  );
}
