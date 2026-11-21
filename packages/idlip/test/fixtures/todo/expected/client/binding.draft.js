import { setAttr } from 'idlip/client';

export function a0(el, { model }) {
  setAttr(el, 'value', model.draft);
}

export function a1(el, { model }) {
  setAttr(el, 'disabled', model.draft === '');
}
