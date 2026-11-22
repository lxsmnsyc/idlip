import { setProp } from 'idlip/client';
import { slot$ } from 'idlip/helpers';

// The message prop carries the path of this component as its owner, so the child's click
// reaches `remove` here and not a handler of the child.
export function p4(scope) {
const c = scope.rows[0].item;
const path = scope.path ?? '';
setProp(slot$(path, 1, c.id), 'onRemove', ['remove', [c.id], '', path]);
}

// Covers `items`.
export function l2({ model }) {
return model.items;
}
