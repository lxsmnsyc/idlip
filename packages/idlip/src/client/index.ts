/**
 * The client runtime that resumes server HTML. Importing it boots the loader, which takes
 * over the events the listener queued. It exports what binding and list chunks import: the
 * patcher, the list patcher, `diffPaths`, `parseHtml` and the block hooks. The DOM and render
 * helpers are copied into the chunks that use them.
 */
import type { Boot, Patch } from '../core/format.ts';
import { patchList } from './list/index.ts';
import { createPatch } from './patch/index.ts';
import { resume } from './loader/resume.ts';

export {
  addBlock,
  diffPaths,
  findInnerBlocks,
  onBlock,
  parseHtml,
  removeBlock,
} from './patch/index.ts';
export { patchList };
export { addChild, setProp } from './nesting.ts';

export const patch: Patch = createPatch(patchList);

const scope = globalThis as typeof globalThis & { $idlip?: Boot };
scope.$idlip ??= [];
resume(scope.$idlip, patch);
