import { setProp } from 'idlip/client';

function encode$(part) {
  return encodeURIComponent(part).replaceAll('-', '%2D');
}

function slot$(path, site, ...keys) {
  let id = String(site);
  for (const key of keys) {
    id += `:${encode$(String(key))}`;
  }
  return path === '' ? id : `${path}/${id}`;
}

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
