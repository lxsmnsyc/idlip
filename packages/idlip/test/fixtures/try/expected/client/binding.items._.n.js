import { setText$ } from 'idlip/helpers';

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function a6(start, { rows }) {
setText$(start, check(rows[0].item.n));
}

// Covers `items`.
export function l5({ model }) {
return model.items;
}
