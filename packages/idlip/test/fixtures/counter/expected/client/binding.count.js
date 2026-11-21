import { setAttr, setBranch, setText } from 'idlip/client';

export function a0(el, { model }) {
  setAttr(el, 'class', { even: model.count % 2 === 0 });
}

export function t1(start, { model }) {
  setText(start, model.count);
}

export function c2(start, { model }) {
  setBranch(start, model.count % 2 === 0 ? 0 : 1, renderC2);
}

function renderC2(branch) {
  return branch === 0 ? '<span>even</span>' : '';
}
