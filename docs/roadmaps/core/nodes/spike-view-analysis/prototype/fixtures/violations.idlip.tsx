// Each marked line breaks one rule. The comment names the rule id the analysis reports.
import { For, Head, Subscribe, Try, trusted } from 'idlip';
import { load, format } from './api';
import { Widget } from './widget';

type Mode = 'a' | 'b';

function helper(value: number): number {
  return value * 2;
}
function Stateful() {
  let n = 0;
  function bump() {
    n = n + 1;
  }
  return <b on:click={bump}>{n}</b>;
}

// body-return: no return.
function NoView() {
  let n = 0;
  function bump() {
    n = n + 1;
  }
}

// props-count: two parameters.
function Two(a: { x: number }, b: { y: number }) {
  return <i>{a.x}</i>;
}

// component-recursive: a stateless component that renders itself.
function Loop() {
  return (
    <div>
      <Loop />
    </div>
  );
}

// event-message-args: a forwarded message prop called with arguments.
// hole-message: a message prop read in a hole.
// hole-children: children read in a hole.
function Forward({ onPick, children }: { onPick: () => void; children?: unknown }) {
  return (
    <b on:click={() => onPick(1)}>
      {format(onPick)} {format(children)}
    </b>
  );
}

// props-whole: the props object passed along by an inlined component.
function Whole(props: { x: number }) {
  return <i>{format(props)}</i>;
}

// props-pattern: a default in the props pattern.
export default function Broken({ size = 1 }: { size?: number }) {
  let draft = '';
  let items: string[] = []; // let-annotation
  let mode = 'a' as Mode; // let-bare-as
  let unset; // let-init
  let copy = draft; // init-scope
  let never = 0; // let-unassigned (warning)
  var legacy = 1; // body-var
  const { length } = draft; // body-destructure
  const markup = <i />; // derived-jsx
  const loopA = loopB; // derived-cycle
  const loopB = loopA;
  if (draft === '') draft = 'x'; // body-statement
  function* steps() {} // handler-generator

  function setDraft(text: string) {
    draft = text;
  }
  function add() {
    items.push(draft); // handler-mutate
    mode.length = 2; // handler-mutate
    loopA = 'x'; // handler-assign
    draft = String(Math.random()); // handler-impure
    const when = new Date(); // handler-impure
    void when;
    void missing; // handler-free
  }
  async function save() {
    if (draft !== '') {
      await load(draft); // await-placement
    }
    const local = async () => 1;
    await local(); // await-callee
    items = [];
    mode = 'b';
  }

  return (
    <main>
      {/* hole-closure */}
      <p>{() => draft}</p>
      {/* hole-method: split is not on the allow-list */}
      <p>{draft.split(',')}</p>
      {/* hole-global: JSON is not on the allow-list */}
      <p>{JSON.stringify(draft)}</p>
      {/* hole-impure */}
      <p>{Math.random()}</p>
      {/* hole-array */}
      <p>{format([1, ...items])}</p>
      {/* hole-call */}
      <p>{draft()}</p>
      {/* hole-effect */}
      <p>{new Date()}</p>
      {/* hole-grammar */}
      <p>{this}</p>
      {/* hole-jsx */}
      <p>{format(<i />)}</p>
      {/* hole-literal */}
      <p>{format(/x/)}</p>
      {/* hole-member */}
      <p>{format(draft).name}</p>
      {/* hole-object */}
      <p>{format({ ...items })}</p>
      {/* hole-spread */}
      <p>{format(...items)}</p>
      {/* attr-jsx */}
      <p title=<i /> />
      {/* jsx-namespace-tag */}
      <svg:rect />
      {/* for-each */}
      <For key="id">{(item) => <li>{item}</li>}</For>
      {/* for-param */}
      <For each={items} key="id">
        {([first]) => <li>{first}</li>}
      </For>
      {/* global-children */}
      <window>text</window>
      {/* subscribe-children */}
      <Subscribe to={load}>text</Subscribe>
      {/* component-import */}
      <Widget />
      {/* props-whole */}
      <Whole x={1} />
      {/* component-recursive */}
      <Loop />
      {/* hole-handler */}
      <p>{setDraft}</p>
      {/* hole-statement */}
      <p>{(draft = 'x')}</p>
      {/* hole-unknown */}
      <p>{nowhere}</p>
      {/* helper-closure */}
      <p>{format(draft, (x: string) => x)}</p>
      {/* hole-operator */}
      <p>{'a' in items}</p>
      {/* hole-function-value */}
      <p>{helper}</p>
      {/* view-map */}
      <ul>{items.map((item) => item)}</ul>
      {/* condition-operator */}
      {draft || <p>empty</p>}
      {/* event-closure */}
      <button on:click={() => save() && save()}>x</button>
      {/* event-target */}
      <button on:click={() => console.log(draft)}>x</button>
      {/* event-param */}
      <button on:click={({ target }) => setDraft(target)}>x</button>
      {/* event-mode-twice */}
      <button on:click={save} latest:click={save}>
        x
      </button>
      {/* for-key */}
      <For each={items}>{(item) => <li>{item}</li>}</For>
      {/* for-render */}
      <For each={items} key="id">
        {items}
      </For>
      {/* ref-form */}
      <input ref={draft} />
      {/* html-trusted */}
      <div html={draft} />
      {/* html-children */}
      <div html={trusted(draft)}>child</div>
      {/* html-nesting */}
      <p>
        <div>block in paragraph</div>
      </p>
      {/* html-implied */}
      <table>
        <tr>
          <td>row</td>
        </tr>
      </table>
      {/* html-nesting: text in a table */}
      <table>text</table>
      {/* html-nesting: link in a link */}
      <a href="/">
        <a href="/x">nested link</a>
      </a>
      {/* title-outside-head */}
      <title>Outside head</title>
      {/* subscribe-input-key */}
      <Subscribe to={load} input={draft} on:value={setDraft} />
      {/* subscribe-source */}
      <Subscribe to={(x: number) => x} on:value={setDraft} />
      {/* jsx-spread */}
      <div {...{ id: 'x' }} />
      {/* component-unknown */}
      <Missing />
      {/* global-attr */}
      <window class="x" />
      {/* try-catch */}
      <Try catch="oops">body</Try>
      {/* child-children */}
      <Stateful>child</Stateful>
      {/* no error: a title in Head */}
      <Head>
        <title>{draft}</title>
      </Head>
      {/* hole-unknown: size is dropped with the rejected pattern */}
      {size}
    </main>
  );
}
