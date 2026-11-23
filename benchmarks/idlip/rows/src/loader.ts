// The loader of the rows page. Most handlers call the list operations of `harness/rows.mjs`, and
// a click must not load a shared chunk, so the loader imports them at start.
import 'idlip/client';

export { build, remove, swap, update } from '../../../harness/rows.mjs';
