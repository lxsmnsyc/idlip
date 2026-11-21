# Change request: markup-grammar

Status: applied. The contract text needed no change: its fragment rule stands, and the fixture was fixed (`for.tsx.txt` now wraps the outer body in a fragment).

From: markup-lower

## Problem

`packages/idlip/test/compiler/markup/fixtures/for.tsx.txt` does not follow the contract rule that a block body lowers to a fragment. The outer `#for` body holds one `<tr>` and the fixture lowers it without a fragment, `(row, i) => (<tr ...>)`. The inner `#for` body holds one `<span>` and the fixture does lower it to `<>...</>`. `todo.tsx.txt` also uses a fragment for a single `<li>`.

## Proposal

Edit the outer `For` body in `for.tsx.txt` to wrap the `<tr>` in `<>...</>`. The lowering always emits a fragment, as the contract says. Until then `lower.test.ts` collapses a fragment that holds one element before it compares.
