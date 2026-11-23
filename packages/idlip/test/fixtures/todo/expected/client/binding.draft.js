import { setAttr$ } from 'idlip/helpers';

export function a0(el, { model }) {
setAttr$(el, 'value', model.draft);
}

export function a1(el, { model }) {
setAttr$(el, 'disabled', model.draft === '');
}
