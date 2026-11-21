# 0005: Markup syntax

Status: rejected (2026-11-21, `docs/roadmaps/core/debates/dsl/debate.md`). TSX stays the one source syntax.

This proposal defines the `.idlip` file: a plain TypeScript module whose components return markup with control-flow blocks. It follows brumate's grammar (`../brumate/docs/grammar.md`) without `<script>`, `<style>`, `#template`, `#loading`, `#portal`, `#client` and the other blocks idlip has no use for yet. Components stay plain functions as in [0002](0002-modules.md), and the effects, subscription, error and head rules of [0004](0004-effects-refs-errors.md) stay as they are.

## Decisions

- **A `.idlip` file is a TypeScript module.** Imports, types, helpers, constants and components are ordinary TypeScript. Nothing about the file is markup except the `return` of a component.
- **Markup appears only as the final `return` of a capitalized function declaration.** The same function-body rules as 0002 apply to the rest of the body. There are no arrow components and no markup in a variable, an argument or a hole.
- **Attributes are JSX-style.** `name="text"`, `name={expr}`, a bare `name`, and the namespaced forms `on:click` and `latest:pointermove`. Brumate's `onClick`, bare-value and `$bind` forms are not used, so the TSX view of 0002 keeps its meaning.
- **Blocks replace the block components.** `#if`, `#for`, `#switch`, `#try`, `#head`. Each lowers to TSX the analyzer already accepts, so the analyzer and everything after it stay as they are. See `contracts/markup-grammar.md` for the table.
- **Block components are never imported.** The lowering adds `import { For, Try, Head, Subscribe } from 'idlip'` for the ones it emitted. A source that declares one of these names is an error.
- **`<subscribe>`, `<window>` and `<document>` are lowercase built-ins.** `<subscribe>` lowers to `<Subscribe>`. `<window>` and `<document>` pass through.
- **Expressions are TypeScript and cannot contain markup.** Use a block instead of `cond && <b />`. This keeps holes in the closed grammar and the scanner simple.
- **`#for` needs `by`.** Keys are fields of the item, as in `<For key="id">`. There is no index key and no `#else` on `#for` in this version.
- **`#switch` takes no discriminant.** Each `#case` holds a condition and the first true one renders, as in brumate. The lowering is a chain of conditions, so TypeScript narrows in each case.
- **The compiler lowers to TSX and runs `analyze()` unchanged.** Errors from the analyzer map back to `.idlip` positions with a segment table.
- **File suffix `.idlip`.** Files named `*.idlip.tsx` keep working: they are TSX with no markup grammar. A module imports another by `./chart.idlip`.

## Example

```idlip
import type { JSX } from 'idlip/jsx-runtime';
import { every } from 'idlip/sources';

type Load = { state: 'idle' } | { state: 'loading' } | { state: 'failed'; error: string };

export default function Board(props: { cards: Card[] }): JSX.Element {
  let load = { state: 'idle' } satisfies Load as Load;
  let live = false;
  let ticks = 0;

  function reload() { load = { state: 'loading' }; }
  function toggle() { live = !live; }
  function tick(count: number) { ticks = count; }

  return (
    <main>
      #head {
        <title>{ticks} ticks</title>
      }
      #if (live) {
        <subscribe to={every} input={1000} on:value={tick} />
      }
      #switch {
        #case (load.state === 'loading') { <p>Loading</p> }
        #case (load.state === 'failed') { <p>{load.error}</p> }
        #default { <button on:click={reload}>Load</button> }
      }
      #try {
        <ul>
          #for (card of props.cards by card.id) {
            <li>{card.name}</li>
          }
        </ul>
      } #catch (error, reset) {
        <p>Failed: {String(error)} <button on:click={reset}>Retry</button></p>
      }
    </main>
  );
}
```

The fixtures in `packages/idlip/test/compiler/markup/fixtures/` pair each block with its TSX. The tests check that each expected TSX file passes `analyze()` with no errors. The parser and lowering come with `markup-parser` and `markup-lower`, which turn the same pairs into tests of their own.

## How a file is read

1. **Find the components.** The parser scans the top level of the file as TypeScript, skipping strings, template literals, regular expressions and comments, and matching brackets. For each capitalized function declaration, with or without `export` and `default`, it looks at the top-level statements of the body. The last one that is `return` followed by `<` or `#`, or by `(` and then `<` or `#`, starts the markup.
2. **Read the markup** with the grammar in the contract. It ends at the `}` that closes the function body. A trailing `;` and the closing `)` are allowed.
3. **Everything else is TypeScript.** It is copied to the lowering byte for byte.
4. **Lower** the markup to TSX, add the block import, and keep a segment table.
5. **Analyze** the TSX. Everything after this step is the existing pipeline.

Markup in any other place, such as a lowercase function, an arrow, or a statement before the last `return`, is the error `markup-position`.

## Errors and spans

A diagnostic has `{ rule, severity, message, span }` with `span` in offsets of the `.idlip` source.

- **Parser errors** have a rule id that starts with `markup-` (listed in the contract) and a span in the source from the start.
- **Analyzer errors** keep their rule id. The lowering returns a segment table of `{ out: [start, end], src: [start, end], kind: 'copy' | 'synth' }`. A `copy` segment is text taken from the source: tag and attribute names, expressions, text and the TypeScript outside markup. Offsets inside it map one to one. A `synth` segment is text the lowering wrote: fragments, `<For each key>` attributes, `? :` and `&&`. A span inside a `synth` segment maps to the header of the block that produced it (`#for (row of rows by row.id)`), and a span that crosses segments maps to the smallest source node that holds both ends.
- **`tsc` errors** use the same table, so a type error in a hole shows at the `.idlip` line and column. `markup-language-core` feeds the table to Volar as code mappings.

## Rejected

- Plain TSX with `<Show>` and `<For>` components: decided by the user for a DSL. See the memory note and `debate/debate.md`.
- Markup as an expression, as in JSX: needs a full TSX parser in the scanner and lets markup escape into helpers, where the analyzer cannot follow it.
- Brumate's `<script>` and `<style>` blocks: components are plain functions here, and styles stay in an imported CSS file.
- `onclick` and `{value}` shorthand attributes: they would differ from the `on:click` in 0002 and the existing fixtures for no gain.

## Open questions

- **Packages.** GOAL.md says one published package. Tooling needs a language-core (Volar), a `tsc` wrapper and a VS Code extension. Option A: one package `idlip` with subpaths (`idlip/language-core`, a `idlip-tsc` bin), and the extension kept private in the repo. Option B: `idlip` for the compiler and runtime, and `@idlip/language-core` and `@idlip/tsc` as separate packages, with the extension private. B keeps Volar and its dependencies out of the runtime package and lets the tooling release on its own schedule. A keeps one version and one install. The author leans to B for the two tooling packages and keeps parser and lowering in `idlip/compiler`. The user decides.
- **`#switch` form.** Condition form (as here) or `#switch (expr)` with `#case (value)`. The second reads better for unions but needs a rule for narrowing.
- **`#for ... #else`** for an empty list, as in brumate. It needs the `each` expression twice in the lowering.
- **Text whitespace.** The grammar uses JSX rules (trim lines, drop blank ones). Brumate keeps whitespace as written.
