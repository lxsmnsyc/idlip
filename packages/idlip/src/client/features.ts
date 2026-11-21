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

/** Handlers that `await`, which the task runner serves. */
export const HAS_TASKS: boolean = typeof __IDLIP_HAS_TASKS__ === 'undefined' || __IDLIP_HAS_TASKS__;

/** Paths with a keyed segment such as `todos[id=selected]`, which the diff resolves by key. */
export const HAS_KEYED: boolean = typeof __IDLIP_HAS_KEYED__ === 'undefined' || __IDLIP_HAS_KEYED__;

/** Handlers that call `Dom.focus`, `Dom.scrollIntoView` or `Dom.reset`, which run after the patch. */
export const HAS_REFS: boolean = typeof __IDLIP_HAS_REFS__ === 'undefined' || __IDLIP_HAS_REFS__;
