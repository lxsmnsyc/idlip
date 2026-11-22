import { setText$ } from 'idlip/helpers';

export function t0(start, { model }) {
setText$(start, model.items.length);
}

// Covers `items`.
export function l2({ model }) {
return model.items;
}
