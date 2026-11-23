---
title: idlip/compiler
order: 103
section: Reference
description: Compile a *.tsx file into a server module, client chunks and a manifest, and read its view IR.
---

`idlip/compiler` turns one `*.tsx` file into a server module, client chunks and a manifest. The Vite plugin calls it for you. Call it yourself to check sources in a script or a test, as the docs site does with every `tsx` sample.

```ts
import { compile } from 'idlip/compiler';

const source = `
export default function Counter() {
  let count = 0;
  function increment() {
    count = count + 1;
  }
  return <button on:click={increment}>{count}</button>;
}
`;

const result = compile(source, '/src/counter.tsx');
for (const diagnostic of result.diagnostics) {
  console.log(`${diagnostic.severity} ${diagnostic.rule}: ${diagnostic.message}`);
}
for (const chunk of result.client) {
  console.log(chunk.chunk); // handler=increment, binding=count, ...
}
```

The rule ids of the diagnostics are listed on the [syntax page](./syntax.md#diagnostics).

## Compiling

### `compile`

```ts
function compile(source: string, id: string, options?: CompileOptions): CompileResult;
```

Compiles one `*.tsx` file. `id` is the root-relative Vite id, such as `/src/todo.tsx`; it names the chunks. The result has:

- `server`: the server module's code.
- `client`: the client modules, each `{ chunk, code }`, with a chunk name such as `handler=toggle` or `binding=todos.*.done`.
- `manifest`: what the page carries for the module (events, handlers, binding groups, lists).
- `diagnostics`: each `{ rule, severity, message, span }`, where `span` holds byte offsets.

With an error diagnostic, `server` is empty, `client` is `[]` and the manifest is empty, whichever part found the error. Warnings leave the output in place.

### `CompileOptions`

```ts
type CompileOptions = GenerateOptions;
```

What `compile` takes besides the source and id: `child` and `resolve`, as in `GenerateOptions`.

### `listChildren`

```ts
function listChildren(source: string, id: string): string[];
```

Lists the import specifiers of the stateful children a module renders, such as `./counter.tsx`. The Vite plugin compiles each of those modules with `child: true`.

### `listChildImports`

```ts
function listChildImports(source: string, id: string): ChildImport[];
```

Lists the stateful children that the components of a file render from other files, each once, such as `{ source: './widgets.tsx', imported: 'Counter' }`. The Vite plugin compiles each of those components as a child.

### `ChildImport`

```ts
interface ChildImport {
  source: string;
  imported: string;
}
```

A stateful child that a file renders from another file. `source` is the specifier, such as `./widgets.tsx`. `imported` is `default` or the name of a named component, such as `Counter`.

## Stages

`compile` runs three stages on one analysis. Each stage is exported for tools that need one part.

### `analyze`

```ts
function analyze(file: string, source: string, options?: AnalyzeOptions): ModuleIR;
```

Reads one `*.tsx` file into the view IR: its components, with state, derived values, handlers, view nodes and holes, and the diagnostics of the analysis.

### `AnalyzeOptions`

```ts
interface AnalyzeOptions {
  readImport?: (specifier: string, importer: string) => ImportedModule | undefined;
}
```

`readImport` reads the module an import specifier names, relative to the importing file. The analysis calls it for components imported from `.tsx` files, to tell a stateless component, which it inlines, from a stateful one, which becomes a child block. Without it, or when it returns `undefined`, an imported component is a child block.

### `ImportedModule`

```ts
interface ImportedModule {
  /** The resolved file name, used in diagnostics. */
  file: string;
  source: string;
}
```

### `generate`

```ts
function generate(
  ir: ModuleIR,
  source: string,
  id: string,
  options?: GenerateOptions,
): GenerateResult;
```

Generates the server module, the binding and list chunks and the manifest of one file. Handler chunks come from `compileHandlers`.

### `GenerateOptions`

```ts
interface GenerateOptions {
  /** True when a project module renders this module as a child: it gets a `view` chunk. */
  child?: boolean;
  /** Returns the id of the module that an import specifier names. */
  resolve?: (specifier: string, importer: string) => string;
}
```

Without `resolve`, a relative specifier is resolved against the id of the importer.

### `GenerateResult`

```ts
interface GenerateResult {
  server: string;
  client: Module[];
  manifest: Manifest;
  diagnostics: CompileDiagnostic[];
}
```

`server` is empty when a diagnostic is an error. `client` holds binding group chunks and list item template chunks, not handler chunks.

### `GeneratedComponent`

```ts
interface GeneratedComponent {
  name: string;
  manifest: Manifest;
  client: Module[];
}
```

The manifest and view chunks of a component other than the file's first one, by its name in the source.

### `compileHandlers`

```ts
function compileHandlers(file: string, source: string, ir?: ModuleIR): CompileHandlersResult;
```

Compiles the handlers of a file into client modules, one per handler, plus one task chunk per awaited call. `ir` is the analysis of the same source. Without it, the source is analyzed again.

### `CompileHandlersResult`

```ts
interface CompileHandlersResult {
  /** One module per handler, `handler=<tag>`. Empty when a diagnostic is an error. */
  client: Module[];
  diagnostics: CompileDiagnostic[];
  /** True when a handler calls `Dom` after the patch, so the manifest says `after`. */
  after?: true;
}
```

### `listHandlerProps`

```ts
function listHandlerProps(component: Component, handler: Handler): string[];
```

Lists the props values a handler needs: the paths it reads, then those of the handlers it calls. They come first in the event payload, before the handler's arguments, so a rest parameter stays last.

### `pickComponent`

```ts
function pickComponent(ir: ModuleIR): Component | undefined;
```

Returns the root component of a module: the first exported stateful one, else the first stateful one.

### `selectComponents`

```ts
function selectComponents(
  ir: ModuleIR,
  source: string,
  id: string,
  options?: SelectOptions,
): { selected: Selected[]; diagnostics: CompileDiagnostic[] };
```

Picks the components of a file that compile to their own manifest, chunks and render function: the default export, each named export, and every other component that one of them renders as a stateful child, in source order. A file with no exported component keeps the old rule: its first stateful component is the main one. The main component has the file's id; every other one adds `#<Name>`.

### `Selected`

```ts
interface Selected {
  component: Component;
  module: string;
  main: boolean;
  exported: boolean;
  child: boolean;
}
```

One component that `selectComponents` picked. `module` is the file id for the main component and `<file>#<Name>` for the others. `main` marks the component the server module exports as `default`. `exported` is true when other files can import it. `child` is true when a module renders it as a child, so it gets a `view` chunk.

### `SelectOptions`

```ts
interface SelectOptions {
  child?: boolean;
  children?: readonly string[];
}
```

`child` is true when another module renders the main component as a child. `children` names the named components that other modules render as children.

## Helpers

### `HELPERS_MODULE`

```ts
const HELPERS_MODULE = 'idlip/helpers';
```

The specifier that chunks import the runtime helpers from. The Vite plugin resolves it to a virtual module.

### `printHelpersModule`

```ts
function printHelpersModule(): string;
```

Returns the source of the `idlip/helpers` module: a copy of every helper, the loader exports they call as imports from `idlip/client`, and an export of each helper. It throws when a bundler renamed a function, since the copies call each other by name.

### `TEMPLATES_MODULE`

```ts
const TEMPLATES_MODULE = 'idlip/templates';
```

The specifier that chunks import a template from when more than one chunk renders it. The export of a template is `t` and the hash of its namespace and markup. The Vite plugin finds the shared templates, passes their hashes as `shared` to `compile`, and resolves the specifier to a virtual module written by `printTemplatesModule(templates)`. Without `shared`, every chunk declares its templates.

## Printing

### `printModule`

```ts
function printModule(ir: ModuleIR, source: string): string;
```

Prints the IR of a module as text, with each hole's path set. Useful to see which paths a binding subscribes to.

### `printExpr`

```ts
function printExpr(expr: Expr): string;
```

Prints one IR expression.

### `printPath`

```ts
function printPath(path: Path): string;
```

Prints a model path in the manifest's form, such as `todos.*.done` or `todos[id=selected].text`.

## View IR types

The IR is the output of `analyze` and the input of `generate` and `compileHandlers`. Its shape can change between minor versions before `1.0`.

### `ModuleIR`

```ts
interface ModuleIR {
  file: string;
  components: Component[];
  diagnostics: Diagnostic[];
}
```

### `Component`

One capitalized function declaration. `mode` is `stateful` when it has state or handlers, and a stateful component gets a model slot. A `stateless` one is inlined at each use. It holds `props` (a parameter, a destructuring pattern or none), `state`, `derived`, `handlers`, `view` and `holes`.

### `StateField`

```ts
interface StateField {
  name: string;
  init: Expr;
  /** True when the `let` is assigned in some handler. */
  assigned: boolean;
}
```

A `let` in the component body.

### `Derived`

```ts
interface Derived {
  name: string;
  expr: Expr;
}
```

A `const` in the component body. Holes inline it, so a derived value has no paths of its own.

### `Handler`

A function declaration in the component body: `name`, `params`, `async`, the free names it reads (`free`, each with a `FreeKind` and the paths it reads), the state fields it writes (`writes`), its `segments` and its `span`.

### `HandlerPart`

```ts
interface HandlerPart {
  tag: string;
  /** Locals that live across the `await` that starts this segment. */
  carried: string[];
  /** The awaited call, for segments after the first. */
  awaits: Root | undefined;
}
```

A part of a handler between two `await`s. The first segment is the message itself, and each later one is a continuation with its own tag.

### `FreeKind`

```ts
type FreeKind = 'state' | 'derived' | 'props' | 'handler' | 'import' | 'module' | 'global';
```

What a free name in a handler refers to.

### `Node`

A view node: `text`, `text-hole`, `element`, `for`, `condition`, `try`, `head`, `subscribe`, `global` (`<window>` or `<document>`) or `child` (a stateful component). An element carries its `tag`, `namespace`, `attrs`, `events`, `ref`, `html` and `children`.

### `Namespace`

```ts
type Namespace = 'html' | 'svg' | 'mathml';
```

### `Attr`

```ts
interface Attr {
  name: string;
  value: AttrValue;
  /** How a bound value is checked as a URL. */
  url?: 'url' | 'embed';
}
```

### `AttrValue`

```ts
type AttrValue = { kind: 'static'; value: string | true } | { kind: 'hole'; hole: Hole };
```

### `Ref`

```ts
type Ref = { kind: 'name'; name: string } | { kind: 'tuple'; name: string; key: Expr };
```

### `ForKey`

A `for` node holds `key: ForKey`, from `key={(item) => ...}`:

```ts
type ForKey = { kind: 'field'; field: string } | { kind: 'computed'; expr: Expr };
```

A `field` key is a path of one field of the item. A `computed` key is any other expression that reads the item and globals only. The manifest names a `field` key. The list chunk exports `key(item)` for a `computed` one.

### `Slot`

```ts
type Slot = { kind: 'key'; hole: Hole } | { kind: 'for-key' } | { kind: 'position'; index: number };
```

Where a child's model lives: its `key` prop, else the `<For>` key inside a loop, else its position among the child blocks of the component.

### `Event`

An `on:*` or `latest:*` prop, or a message prop on a child: `name`, `mode` (`on` or `latest`), `body`, `modifiers` and `span`. A `steps` body is the handler calls and branches of an arrow, which compile to a function in the handler chunk. A `message` body is a `target` with `args` and the model `paths` that they read at render: a message prop of a child, a forwarded one or a `reset`.

### `Target`

```ts
type Target =
  | { kind: 'handler'; name: string }
  | { kind: 'prop'; name: string }
  | { kind: 'reset' };
```

What an event dispatches: a handler of the component, a message prop forwarded to the parent, or the `reset` of a `<Try>`.

### `EventModifier`

```ts
type EventModifier =
  | { kind: 'prevent'; keys?: string[] }
  | { kind: 'stop' }
  | { kind: 'once' }
  | { kind: 'capture' }
  | { kind: 'passive' }
  | { kind: 'key'; filter: string };
```

`prevent` and `stop` come from leading `e.preventDefault();` and `e.stopPropagation();` statements, `prevent` with `keys` from a leading `if (<key test>) e.preventDefault();`, and `key` from a sole `if (e.key === '...')` test. A `key` filter is the key name, after any of `Ctrl+`, `Alt+`, `Shift+` and `Meta+` that the test reads, in that order, such as `Escape` or `Ctrl+s`. `once`, `capture` and `passive` have no source form yet.

### `Hole`

```ts
interface Hole {
  id: number;
  expr: Expr;
  paths: Path[] | 'dynamic';
  fallback?: Path[];
  span: Span;
}
```

One expression the view reads, with its path set. `paths` is `dynamic` when the analysis cannot name it, such as a helper that takes an object built from state. Then `fallback` holds the coarse paths the analysis can name.

### `Path`

```ts
interface Path {
  root: 'state' | 'props';
  segments: Segment[];
}
```

A model path, as a binding subscribes to it.

### `Segment`

```ts
type Segment =
  | string
  | { kind: 'item' }
  | { kind: 'index'; value: Expr }
  | { kind: 'keyed'; field: string; value: Expr };
```

A string is a field name. `item` is any element of a list or value of a record, printed `*`. `index` is a computed access. `keyed` is `list.find((t) => t.field === value)`, printed `list[field=value]`.

### `Root`

Where a path starts: `state`, `props`, `loop` (a `<For>` row or index), `event`, `local` (a `<Try>` catch parameter), `global` (a pure global such as `Math.max`), `import` or `module`. Only `state` and `props` paths are model paths.

### `Expr`

An expression in the closed hole grammar: `literal`, `path`, `unary`, `binary`, `logical`, `conditional`, `template`, `object`, `array`, `call`, `method` and `property` (`length`). Derived values and stateless components are already inlined.

### `UnaryOp`

```ts
type UnaryOp = '!' | '-' | '+' | 'typeof';
```

### `BinaryOp`

```ts
type BinaryOp =
  | '==='
  | '!=='
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**';
```

### `Method`

```ts
type Method =
  | 'trim'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'slice'
  | 'includes'
  | 'startsWith'
  | 'endsWith'
  | 'indexOf'
  | 'join'
  | 'at'
  | 'padStart'
  | 'padEnd'
  | 'toFixed';
```

The methods a hole may call on any value. They do not mutate, so their paths are those of the receiver and the arguments.

### `Diagnostic`

```ts
interface Diagnostic {
  rule: string;
  severity: Severity;
  message: string;
  span: Span;
}
```

### `Severity`

```ts
type Severity = 'error' | 'warning';
```

### `Span`

```ts
interface Span {
  start: number;
  end: number;
}
```

A source range in byte offsets into the file.
