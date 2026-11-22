// oxlint-disable no-underscore-dangle
// The features of the loader that a build uses. Each is on unless the build turns it off. The
// Vite plugin replaces the `__IDLIP_HAS_*__` globals in the client build of an app and turns
// off the features that no module of the app uses, so the bundler drops their code. Without
// the plugin (tests, `idlip/testing`, dev) the globals are undefined and every feature is on.
//
// To add a flag: declare the global and the constant here, then add one line to `DETECTORS` in
// `src/vite/features.ts` that reads the feature from the compile result. The name after
// `HAS_` is the same on both sides.

declare const __IDLIP_HAS_TASKS__: boolean | undefined;
declare const __IDLIP_HAS_KEYED__: boolean | undefined;
declare const __IDLIP_HAS_REFS__: boolean | undefined;
declare const __IDLIP_HAS_CHILDREN__: boolean | undefined;
declare const __IDLIP_HAS_SUBS__: boolean | undefined;
declare const __IDLIP_HAS_HEAD__: boolean | undefined;
declare const __IDLIP_HAS_ERRORS__: boolean | undefined;
declare const __IDLIP_HAS_RETRY__: boolean | undefined;
declare const __IDLIP_HAS_SKEW__: boolean | undefined;
declare const __IDLIP_HAS_DYNAMIC__: boolean | undefined;
declare const __IDLIP_HAS_KEY_FN__: boolean | undefined;

/** Handlers that `await`, which the task runner serves. */
export const HAS_TASKS: boolean = typeof __IDLIP_HAS_TASKS__ === 'undefined' || __IDLIP_HAS_TASKS__;

/** Paths with a keyed segment such as `todos[id=selected]`, which the diff resolves by key. */
export const HAS_KEYED: boolean = typeof __IDLIP_HAS_KEYED__ === 'undefined' || __IDLIP_HAS_KEYED__;

/** Handlers that call `Dom.focus`, `Dom.scrollIntoView` or `Dom.reset`, which run after the patch. */
export const HAS_REFS: boolean = typeof __IDLIP_HAS_REFS__ === 'undefined' || __IDLIP_HAS_REFS__;
/** Stateful child components, which the slot table and the `n:` boundaries serve. */
export const HAS_CHILDREN: boolean =
  typeof __IDLIP_HAS_CHILDREN__ === 'undefined' || __IDLIP_HAS_CHILDREN__;
/** `<Subscribe>` blocks, which the loader starts and stops with their markers. */
export const HAS_SUBS: boolean = typeof __IDLIP_HAS_SUBS__ === 'undefined' || __IDLIP_HAS_SUBS__;
/** `<Head>` blocks, which the loader adds to and removes from `<head>` with their markers. */
export const HAS_HEAD: boolean = typeof __IDLIP_HAS_HEAD__ === 'undefined' || __IDLIP_HAS_HEAD__;
/** `<Try>` regions, which the loader swaps to their catch view and resets. */
export const HAS_ERRORS: boolean =
  typeof __IDLIP_HAS_ERRORS__ === 'undefined' || __IDLIP_HAS_ERRORS__;
/** A chunk that fails to load is imported once more at once, before the loader reports it. */
export const HAS_RETRY: boolean = typeof __IDLIP_HAS_RETRY__ === 'undefined' || __IDLIP_HAS_RETRY__;
/** The reload when a chunk fails and the server runs another build. Set by the plugin option `skew`. */
export const HAS_SKEW: boolean = typeof __IDLIP_HAS_SKEW__ === 'undefined' || __IDLIP_HAS_SKEW__;
/** Dynamic holes, whose paths the page state records and the patch reads. */
export const HAS_DYNAMIC: boolean =
  typeof __IDLIP_HAS_DYNAMIC__ === 'undefined' || __IDLIP_HAS_DYNAMIC__;
/** A `<For>` key that is not one field of the item, which the list chunk evaluates. */
export const HAS_KEY_FN: boolean =
  typeof __IDLIP_HAS_KEY_FN__ === 'undefined' || __IDLIP_HAS_KEY_FN__;
