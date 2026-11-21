import { addChild } from 'idlip/client';
import * as Counter from '/src/counter.idlip.tsx?idlip-view&lang.js';

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

// `addChild` makes the child's model from `init`, records the slot and returns the child's
// markup between its boundary comments.
export function render(scope) {
  const c = scope.rows[0].item;
  const path = scope.path ?? '';
  return addChild(slot$(path, 1, c.id), '/src/counter.idlip.tsx', Counter, {
    label: c.label,
    onRemove: ['remove', [c.id], '', path],
  });
}
