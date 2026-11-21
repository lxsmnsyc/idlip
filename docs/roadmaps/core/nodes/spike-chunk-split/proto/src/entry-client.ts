/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
// The resume loader. It imports no module of the app: the server writes the
// chunk URLs into the page, and the loader imports one when an event needs it.
import { Random } from './runtime.ts';

export function loadChunk(url: string): Promise<unknown> {
  return import(/* @vite-ignore */ url);
}

Reflect.set(globalThis, '__idlipRandom', Random);
