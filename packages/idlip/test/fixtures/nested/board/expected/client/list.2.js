import { addChild } from 'idlip/client';
import { slot$ } from 'idlip/helpers';
import { init as $init_Counter, render as $render_Counter } from '/src/counter.tsx?idlip-view&lang.js';

const Counter = { init: $init_Counter, render: $render_Counter };

// `addChild` makes the child's model from `init`, records the slot and returns the child's
// markup between its boundary comments.
export function render(scope) {
const c = scope.rows[0].item;
const path = scope.path ?? '';
return addChild(slot$(path, 1, c.id), '/src/counter.tsx', Counter, { label: c.label, onRemove: ['remove', [c.id], '', path] });
}
