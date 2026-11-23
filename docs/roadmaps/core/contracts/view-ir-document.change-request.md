# Change request: view-ir, the document skeleton

- From node: entry-setup
- Status: open. Approved by the user on 2026-11-23 (`nodes/entry-setup/proposal.md`, decisions 3, 4 and 5).

## Problem

A view could hold `html`, `head` and `body` anywhere, and the compiler said nothing, though a client template drops them. A `<title>` in `<head>` was the error `title-outside-head`, which blocks a document component.

## Proposed change

- **The skeleton.** A document view is exactly `<html>` with one `<head>` and then one `<body>` as its children. It is the root of the view of a component that the server renders as the whole page. Any `html`, `head` or `body` element elsewhere (in a condition, a list, a `<Try>`, inside another element, or as a root with other children) is the error `document-element-misplaced`. A child component never renders them.
- **The head.** The document `<head>` follows the `<Head>` rules, and with a hole in it, it is the first `<Head>` block. A head with no hole stays markup in `<head>`, so the loader needs nothing for it. Its children follow the `<Head>` rules (elements only, no events, `ref` or `html`, one `<title>`, a hole in a title is its only content). `<title>` in it is allowed. It is the default title, and a `<Head>` in the body ranks after it, so the last title wins as before.
- **What is dynamic.** Bound attributes and holes are allowed on `<html>` and `<body>` attributes and, by the `<Head>` rules, in the head. Events, `ref` and `html=` on `html`, `head` and `body` are an error (`document-element-misplaced`). Conditions, lists and `<Try>` around the skeleton are an error. A head element with an event, `ref` or `html` is the existing error `codegen-unsupported` ("A head element takes no events, ref or html"). Static `<style>` and `<script>` text in the document head stays markup.
- **The manifest.** `Manifest.document: true` (see `compiled-format-document`).

## Affected nodes

`view-analysis` (the check), `ssr-render` and `document-head` (the head block 0).

## Workaround in place

Implemented in `src/compiler/view/analyze/analyze.ts` and `src/compiler/view/codegen`.

## Decision

Pending.
