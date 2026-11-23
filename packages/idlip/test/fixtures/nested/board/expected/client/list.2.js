import { addChild } from 'idlip/client';
import { clone$, slot$ } from 'idlip/helpers';
import { init as $init_Counter, render as $render_Counter } from '/src/counter.tsx?idlip-view&lang.js';

const Counter = { init: $init_Counter, render: $render_Counter };

const templateL2$ = { h: '<!--i--><!--n:x1--><!--/n--><!--/i-->', n: 1 };

// `addChild` makes the child's model from `init`, records the slot and returns the child's
// nodes, which go between the boundary comments of the template.
export function render(scope, $doc) {
const c = scope.rows[0].item;
const path = scope.path ?? '';
const $n = clone$(templateL2$, $doc);
const $np1 = slot$(path, 1, c.id);
$n[1].data += $np1;
$n[1].after(addChild($np1, '/src/counter.tsx', Counter, { label: c.label, onRemove: ['remove', [c.id], '', path] }, $doc));
return $n[0];
}

export const blocks = true;
