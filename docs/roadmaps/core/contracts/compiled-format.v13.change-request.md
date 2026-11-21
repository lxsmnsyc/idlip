# Change request: compiled-format v12 to v13

- From node: fix-global-late-listener
- Status: proposed

## Problem

The early listener added a window or document listener for an event type only when a template for it was already on the page. A `<window>` or `<document>` that a patch adds later never got one. Adding the listener for every type a record names fixes that, but costs every page one window and one document listener per type, with a `querySelectorAll` per event, even with no global element.

## Proposed change

- `manifest.events` lists an event of a `<window>` or `<document>` as `<type>:window` or `<type>:document`, in place of the bare type. Other elements keep the bare type. A module that uses `keydown` on `<window>` and on a button lists both `keydown` and `keydown:window`.
- The record's event string carries the same tokens. The early listener adds a window or document listener for a `:window` or `:document` token, and no document delegation for it. It adds the listener at record time, so a global element that a patch inserts later is heard.
- Contract text, Delegated listening (line ~135): after the `<template i-global=...>` sentence add "The type is listed as `<type>:window` or `<type>:document` in `manifest.events` and in the record, even when the element sits in a condition."

## Affected nodes

- `listens` stays keyed by the bare type, so `renderPreload` is unaffected.
- Fixtures with a `<window>` or `<document>` list the new tokens in their manifest.
