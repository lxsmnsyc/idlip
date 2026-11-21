---
name: markup-grammar
version: 1
status: frozen
defined_by: markup-syntax
---

# Contract: markup-grammar

## Purpose

The grammar of `.idlip` files, and how markup lowers to the TSX that `analyze()` accepts. Used by `markup-parser`, `markup-lower`, `markup-compile` and `markup-language-core`. Rationale and examples are in `docs/proposals/0005-markup.md`.

## Interface

### File

A `.idlip` file is a TypeScript module. Markup is allowed in one place: the final `return` of a capitalized function declaration, directly in the function body. The markup starts after `return` (and an optional `(`) at `<` or `#`, and ends at the `}` that closes the function body. A trailing `)` and `;` are allowed.

EBNF: `{ x }` zero or more, `[ x ]` optional, `TS<rule>` text the TypeScript parser reads. Whitespace between tokens is allowed unless a rule says otherwise.

```ebnf
Return      = "return" [ "(" ] Markup { Markup } [ ")" ] [ ";" ] ;
Markup      = Element | Component | Builtin | Fragment | Text | Insert | Comment | Block ;

Element     = "<" Lower { NameChar } { ws Attribute } [ ws ]
              ( "/>" | ">" { Markup } "</" Name ">" )
            | "<" Void { ws Attribute } [ ws ] [ "/" ] ">" ;
Component   = "<" Upper { IdentChar } { "." Ident } { ws Attribute } [ ws ]
              ( "/>" | ">" { Markup } "</" Name ">" ) ;
Builtin     = "<subscribe" { ws Attribute } [ ws ] "/>"
            | "<" ( "window" | "document" ) { ws Attribute } [ ws ] "/>" ;
Fragment    = "<>" { Markup } "</>" ;
Insert      = "{" TS<Expression> "}" ;
Text        = TextChar { TextChar } ;
Comment     = "<!--" { any } "-->" ;

Attribute   = Name [ "=" ( String | "{" TS<Expression> "}" ) ] | "{..." TS<Expression> "}" ;
Name        = NameStart { NameChar } [ ":" NameStart { NameChar } ] ;
String      = '"' { any - '"' } '"' | "'" { any - "'" } "'" ;

Block       = IfBlock | ForBlock | SwitchBlock | TryBlock | HeadBlock ;
Body        = "{" { Markup } "}" ;

IfBlock     = "#if" "(" TS<Expression> ")" Body
              { "#else" "if" "(" TS<Expression> ")" Body }
              [ "#else" Body ] ;
ForBlock    = "#for" "(" TS<BindingPattern> [ "," Ident ] "of" TS<Expression>
              "by" TS<Expression> ")" Body ;
SwitchBlock = "#switch" "{" { "#case" "(" TS<Expression> ")" Body }
              [ "#default" Body ] "}" ;
TryBlock    = "#try" Body "#catch" "(" Ident [ "," Ident ] ")" Body ;
HeadBlock   = "#head" Body ;
```

Lexical rules:

- `Void` is `area base br col embed hr img input link meta source track wbr`. `Upper` and `Lower` are the first letter. `<window>`, `<document>` and `<subscribe>` are not elements, and `<script>` and `<style>` are errors.
- Attribute values are a string or a braced expression. There is no bare value. Event attributes keep the `on:` and `latest:` form of the existing view grammar.
- `TextChar` is any character except `<`, `{` and a `#` that starts a block. A `}` in text closes the enclosing block body, so a literal one is written `{'}'}`. Text follows JSX whitespace rules: lines are trimmed, blank lines dropped, lines joined with one space. HTML entities are decoded as JSX decodes them.
- `#` starts a block only when it is not right after a letter, digit, `_` or `$`, a block keyword follows, and the keyword is followed by `(` or `{`. The keywords are `if for switch try head`. Inside a block, `else`, `case`, `default` and `catch` are keywords where the grammar expects them. Any other `#` is text.
- `#else`, `#else if` and `#catch` follow the closing `}` of the previous body, with only whitespace and comments between. Only `#case`, `#default`, whitespace and comments are allowed directly inside `#switch`, and `#default` is last.
- A `TS<...>` region ends at the bracket that closes it. The scanner skips strings, template literals, regular expressions and comments while it counts. The region is then parsed by oxc. Expressions cannot contain markup.
- In `#for`, `by` names a field of the item: `by row.id` when the item is the identifier `row`, or `by id` when the item is an object pattern that binds `id`. The index name, if any, is a plain identifier.
- A source that declares or imports `For`, `Try`, `Head` or `Subscribe` is an error, and so is `<For>`, `<Try>`, `<Head>` or `<Subscribe>` in markup.

### Lowering

The lowering produces TSX for the existing analyzer. A block body of zero or more markup nodes lowers to a fragment, `<>...</>`. A block in the child list of an element lowers to a braced expression. When the `return` has several root nodes, they are wrapped in one fragment.

| Source                                                       | TSX                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `#if (c) { A }`                                              | `{c && (<>A</>)}`                                                                       |
| `#if (c) { A } #else { B }`                                  | `{c ? (<>A</>) : (<>B</>)}`                                                             |
| `#if (c) { A } #else if (d) { B } #else { C }`               | `{c ? (<>A</>) : d ? (<>B</>) : (<>C</>)}`                                              |
| `#switch { #case (c) { A } #case (d) { B } #default { C } }` | the chain of `#if ... #else if ... #else`; without `#default` the last branch is `null` |
| `#for (t, i of xs by t.id) { A }`                            | `<For each={xs} key="id">{(t, i) => (<>A</>)}</For>`                                    |
| `#try { A } #catch (error, reset) { B }`                     | `<Try catch={(error, reset) => (<>B</>)}>A</Try>`                                       |
| `#head { A }`                                                | `<Head>A</Head>`                                                                        |
| `<subscribe to={s} ... />`                                   | `<Subscribe to={s} ... />`                                                              |
| `<window ... />`, `<document ... />`                         | unchanged                                                                               |

The lowering appends one line after the last line of the source: `import { <used block names> } from 'idlip';`, with the names in the order `For`, `Head`, `Subscribe`, `Try`, only those it emitted. Appending keeps the line numbers of the source. Everything outside the markup is copied unchanged. `#else if` and `#case` need no extra nodes, so `condition` IR nodes nest as the analyzer expects.

### Segment table

`lower()` returns `{ code, segments, diagnostics }`. A segment is `{ out: [start, end], src: [start, end], kind: 'copy' | 'synth' }`, with offsets into `code` and the `.idlip` source. `copy` segments hold text taken from the source: names, expressions, text, and all TypeScript outside markup. Offsets inside a `copy` segment map one to one. `synth` segments hold text the lowering wrote and map to the header span of the block that produced them (`#for (...)`, `#if (...)`, `#catch (...)`) or to the element for a fragment. A span from `analyze()` or `tsc` maps back by its end points. If the end points fall in different segments, the result is the smallest source node that holds both.

### Errors

A parse or lowering error has `{ rule, severity: 'error', message, span }`, with `span` in offsets of the source. Analyzer diagnostics keep their rule ids and have their spans mapped.

| Rule id               | Meaning                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `markup-position`     | Markup outside the final `return` of a capitalized function.          |
| `markup-unclosed`     | An element, block body, expression or comment is not closed.          |
| `markup-tag-mismatch` | A closing tag does not match its opening tag.                         |
| `markup-header`       | A block header is malformed: missing `(`, `)`, `of` or `by`.          |
| `markup-for-key`      | `by` is not a field of the item.                                      |
| `markup-orphan`       | `#else`, `#case`, `#default` or `#catch` where its block is not open. |
| `markup-switch-child` | Something other than `#case` or `#default` inside `#switch`.          |
| `markup-catch`        | `#try` without `#catch`, or a `#catch` that does not name an error.   |
| `markup-reserved`     | A declaration or tag uses `For`, `Try`, `Head` or `Subscribe`.        |
| `markup-attribute`    | A malformed attribute, such as a bare value or an unquoted string.    |
| `markup-expression`   | An expression holds markup, or a `TS<...>` region does not parse.     |
| `markup-element`      | `<script>` or `<style>`, or a void element with children.             |

### Block-to-component mapping

For `document-head`, `errors` and `commands-subs`:

| Block or built-in                     | View IR node (`contracts/view-ir.md`) | Analyzer tag          |
| ------------------------------------- | ------------------------------------- | --------------------- |
| `#if`, `#else if`, `#else`, `#switch` | `condition`                           | none (`? :` and `&&`) |
| `#for`                                | `for`                                 | `<For>`               |
| `#try`, `#catch`                      | `try`                                 | `<Try>`               |
| `#head`                               | `head`                                | `<Head>`              |
| `<subscribe>`                         | `subscribe`                           | `<Subscribe>`         |
| `<window>`, `<document>`              | `global`                              | same                  |

## Behavior

- Every block lowers to TSX that `analyze()` accepts with no errors when the same view written in TSX would pass. The fixtures show this for each block.
- Block components are never imported in a `.idlip` file.
- Lowering never changes the TypeScript outside the markup.
- The lowering output depends only on the source text, so equal sources give equal TSX.

## Stub

Paired fixtures in `packages/idlip/test/compiler/markup/fixtures/`: `<name>.idlip.txt` is the source and `<name>.tsx.txt` the expected lowering. Fixtures: `if`, `for`, `switch`, `try`, `head`, `listeners` (`<subscribe>`, `<window>`, `<document>`) and `todo`.

## Contract tests

`packages/idlip/test/compiler/markup/`. `fixtures.test.ts` checks that each source has an expected TSX file that passes `analyze()` with no errors, and that each block has a fixture. `markup-parser` and `markup-lower` add tests that parse and lower each source to its expected TSX.

## Changes

- v1: initial text, from `markup-syntax`.
