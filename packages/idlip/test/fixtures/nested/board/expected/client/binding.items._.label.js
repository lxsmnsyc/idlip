import { setProp } from 'idlip/client';
import { slot$ } from 'idlip/helpers';

// A props binding: it has no node. It tells the loader the new value of one prop of a slot.
export function p3(scope) {
const c = scope.rows[0].item;
setProp(slot$(scope.path ?? '', 1, c.id), 'label', c.label);
}

// Covers `items`.
export function l2({ model }) {
return model.items;
}
