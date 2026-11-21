---
goal: Decide how idlip components declare subscriptions (timers, sockets, custom async sources, window and document events) under the no-compile-time-API and no-implicit-state-machine rules
date: 2026-11-21
rounds: 3 of 3
status: approved
roadmap: docs/roadmaps/core
supersedes: none
decision: none
---

# Debate: how components declare subscriptions

Options weighed: (A) `<Subscribe>` in the view, started and stopped by its block; (B) a `for await` loop in an async handler; (C) a declaration in the component body, as in the first 0002 draft; (D) `<window>` and `<document>` elements plus one of the others.

## Settled structure

1. **`<window>` and `<document>` elements ship first.** They take event props like any element and are delegated by the loader. They need no source chunk, no marker and no block hook. (P3, P10)
2. **Every event queues by default** and keeps its own value, as `compiled-format` requires for queued `input` events. Latest-wins is opt-in in the source with a `latest:` attribute, for example `<window latest:pointermove={move} on:keydown={key} />`. `on:x` and `latest:x` on one element is a compile error. Dev builds warn when the pending queue grows deep. (P12, O8, O14, O15)
3. **`<Subscribe to={source} input={value} on:value={handler}>` is the one general form,** written under a condition on an explicit state union. It starts when its block is added and stops when the block is removed. No handle is stored. (P1)
4. **Input is read once at start.** A new run needs a new `key` or a remount through the condition. The runtime never compares inputs. The compiler rejects an `input` that reads state unless `key` reads the same state. (P2, O3, P6)
5. **A source is a module-level async generator `(input, signal)`.** A source with several parameters takes one input object. Stock sources (timer, WebSocket, EventSource, media query) are plain async generators shipped by idlip. (P3, O2, P6)
6. **Delivery is pull-based.** The loader asks for the next value only after the previous message has patched, so each subscription has one value in flight and the source decides what to drop. Each value is an ordinary message whose payload is checked for serializability at dispatch in dev builds. (P4, P7, O1)
7. **Stop is immediate for delivery.** On block removal the runtime aborts the signal, calls `return()` without awaiting it, and drops any later yield, so no handler runs after the block is gone. Cleanup is prompt for sources that end their awaits on the signal: stock sources do, and custom sources use `until(signal, promise)` or `Time.sleep(ms, signal)`. Dev builds warn when `return()` has not settled 1000 ms after abort. (P11, O7, O13)
8. **Resume.** The server renders one marker per active `<Subscribe>`, with the source chunk id and the serialized input. The loader starts sources whose markers are in the page. A page without subscriptions loads nothing for them, and a stopped source leaves no marker. (P5)
9. **One block hook.** `patch-bindings` owns a block add/remove hook declared once in `compiled-format` (v7). `patch-lists` calls it for `<For>` rows, `document-head` and `errors` call it for `<Head>` and `<Try>`, and `commands-subs` registers start and stop on it. Starting a source is not awaited by `patch()`. (P14, J11, O16)
10. **Dev log.** A ring of 1000 messages, each with its recorded model. Replay starts from the oldest kept entry. Production keeps no log. (P13, J13, O9)

## Budget

- device: no build in the debate. Runtime cost is zero bytes for pages without subscriptions, and one value in flight per subscription. (J1, P5, P7)
- time: `commands-subs` stays a should node in `apps`, off the must path. The block hook adds work to `patch-bindings`, a must node of size M, and `compiled-format` moves to v7. (J2, O16)
- tokens: about 351k for this debate.
- explicitness: every start and stop is the add or removal of a block under a visible condition on a state union, every restart is a visible `key`, and every coalescing is a visible `latest:` attribute. The runtime compares no inputs. (P1, P2, P12)

## Rejected

- B, `for await` in a handler: a quiet source stays open until its next value, a resumed page needs a second hand-written start path, and it reverses the rule against `await` in loops. Its hidden-handle drawback is shared with A, so it does not decide. (P8, P15, O10)
- C, a declaration in the component body: a compile-time API, since the body never runs. Its `when` condition survives as the condition around `<Subscribe>`. (J3, P9)
- A self-scheduling timer handler: a page resumed in the running state has no pending sleep, so the timer never restarts. (A1, O6)
- Stock sources only in v1: they still need the block hook, and the goal names custom sources. (A2, J11)
- Restarting when `input` changes, as in the draft: an input comparison, forbidden by the rule against implicit state machines. (P2)
- Latest-wins by default for window and document events: drops `keydown` and `input` values. (P7, O8)
- A `<Subscribe>` limited to top-level blocks as a fallback: it cannot stop. (O11)

## Scope changes

- Remove the stale `errors` to `commands-subs` edge, whose reason refers to commands that no longer exist. (J12, O11)
- `patch-bindings` takes on the block add/remove hook. (P14)

## Proofs

- None. The typing claims were settled by `tsc` 7.0.2 measurements (J6, O1, O2) and the generator `return()` behavior by a node run (O7).

## Prior art

- brumate: `<window>` and `<document>` elements in markup, stopped while hidden; `$effect` and `$client` for long-lived effects, which use compile-time markers and reactive reads. (J7)
- Elm, Iced, Hyperapp v2: subscriptions computed from the model and compared after each update. (J8)
- redux-saga and Crank.js: long-lived generator loops, cancelled through a task handle or a race. (J9)

## Open risks

- A custom source that does not observe its signal keeps its socket or listener open after stop. Accepted: no static check can see it; dev builds warn after 1000 ms. (O13)
- A fast `on:` event without `latest:` queues every event, about 30 during a 500 ms cold chunk load at 60 Hz. Accepted with the dev warning on queue depth. (O15)

## Inferred choices

- No compile-time APIs, with block components tolerated for the TSX proof of concept (J3): from `docs/proposals/0002-modules.md` and the user, 2026-11-21.
- One explicit union per lifecycle, no input comparison (J4): from the user's rule of 2026-11-20.
- `latest:` is attribute syntax like `on:`, not a compile-time API (O14): inferred from J3.

## Answers from the user

- None asked. Approved by the user on 2026-11-21.

## Overruled

- None.

## Cost of this debate

- 3 of 3 rounds, about 351k tokens
