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

// A props binding: it has no node. It tells the loader the new value of one prop of a slot.
export function p3(scope) {
  const c = scope.rows[0].item;
  setProp(slot$(scope.path ?? '', 1, c.id), 'label', c.label);
}

// Covers `items`.
export function l2({ model }) {
  return model.items;
}
