# Opponent round 2 evidence

## P10 line counts checked (method spans in analyze.ts, line distance to next method)

```
652 24   lowerDerived(name
1106 237   createHole(node
1643 163   lowerElement(tag
1938 262   lowerBlock(tag
2200 167   lowerChild(node
2367 275   analyzeComponent(name
2642 551   analyzeHandler(fn
3383 48 function readModule(program
```

Matches P10 (createHole is 237 lines in all; its event part 1184-1263 is about 80, P10 says about 120). About 800 rewritten holds within 10%.

## O11: the J13 route reuses analyze() whole

v1 already did this for blocks: 0005-markup.md 'The compiler lowers to TSX and runs analyze() unchanged'; v1 fixture pairs todo.idlip.txt / todo.tsx.txt (feat/markup-frontend test/compiler/markup/fixtures).
1:1 mapping of P9 constructs to today's input: model field -> let (internal form needs no types), derived x = e -> const x = e, arm Name(a) { body } -> function Name(a) { body }, view -> return (<>...</>), on:click={Toggle(t.id)} -> on:click={() => Toggle(t.id)}, on:click={Save} -> on:click={Save} (analyze.ts:1184 'An event prop takes a handler, or an arrow whose body is one handler call').
v1 calibrated (J2): markup-parser 172,017, markup-lower 153,801, markup-compile 145,785 = 471,603.
CALIBRATION.md S range 83k-174k.

## O12: diagnostics worded in TSX terms

```
diagnostic sites (reportError( or rule: '): 100
message lines naming <For>/<Try>/<Head>/<Subscribe>/arrow/let/const/return/function/JSX/.map()/ternary: 54
1185-        'An event prop takes a handler, or an arrow whose body is one handler call',
1230-          'A closure is not allowed as a handler argument',
1264-        'The body of an event arrow must be one handler call, optionally behind e.preventDefault(), e.stopPropagation() or an if on e.key',
1487:      this.reportError('view-map', 'Lists are written with <For each key>, not .map()', node);
2108-        '<For> takes one child: (item, index?) => <jsx>',
2609-          `The state field ${field.name} is never assigned; make it a const`,
 * `.idlip` module, which points into its lowered code, to point into its source.
 */
function mapMessage(imports: ReadonlyMap<string, ImportedMarkup>, message: string): string {
  for (const [file, imported] of imports) {
    const prefix = `${file}:`;
    if (!message.startsWith(prefix)) {
      continue;
    }
    const match = /^(\d+):(\d+): /.exec(message.slice(prefix.length));
    if (match === null) {
      continue;
    }
    const offset = findOffset(imported.lowered.code, Number(match[1]), Number(match[2]));
    const span = mapSpan(imported.lowered, offset, offset + 1);
    return `${prefix}${locate(imported.source, span[0])}: ${message.slice(prefix.length + match[0].length)}`;
  }
  return message;
}
```

v1 mapMessage rewrites only the position prefix, not the text.

## O13: B already compiles events and child callbacks to message data

```
      <Counter label="Spare" onRemove={clearAll} />
      <For each={items} key="id">
        {(c) => <Counter label={c.label} onRemove={() => remove(c.id)} />}
on:click='["remove",["a1"],"",""]'
onRemove:["remove",["a1"],"",""]
```

Elm architecture (https://guide.elm-lang.org/architecture/): type Msg = ...; update : Msg -> Model -> Model (pure, returns the new model); effects as Cmd Msg (guide.elm-lang.org/effects). P9 keeps none of: pure update returning a model, Cmd effects (J12), a Msg type separate from update (P9 merges them into arms).

## O13: P11's narrowing fix is real (tsc 7.0.2 --strict)

```
type S = { state: 'idle' } | { state: 'failed'; error: string };
export function C() {
  let s!: S;
  const $init: { s: S } = { s: { state: 'idle' } };
  function fail() { s = { state: 'failed', error: 'x' }; }
  return [$init, fail, s.state === 'failed' ? s.error : ''];
}
export function B() {
  let s: S = { state: 'idle' };
  function fail() { s = { state: 'failed', error: 'x' }; }
  return [fail, s.state === 'failed' ? s.error : ''];
}
--- output:
a.ts(11,17): error TS2367: This comparison appears to be unintentional because the types '"idle"' and '"failed"' have no overlap.
a.ts(11,42): error TS2339: Property 'error' does not exist on type 'never'.
```

C (let s!: S, as P11 lowers) passes; B (annotated let with initializer) fails TS2367, which is why 0002:116 uses satisfies T as T.
