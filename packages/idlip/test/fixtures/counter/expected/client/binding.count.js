import { clone$, setAttr$, setBranch$, setText$ } from 'idlip/helpers';

const templateC2_0$ = { h: '<span>even</span>', n: 0 };

export function a0(el, { model }) {
setAttr$(el, 'class', { even: model.count % 2 === 0 });
}

export function a1(start, { model }) {
setText$(start, model.count);
}

export function c2(start, { model }) {
setBranch$(start, model.count % 2 === 0 ? 0 : 1, renderC2);
}

function renderC2(branch, $doc) {
if (branch === 0) {
return clone$(templateC2_0$, $doc)[0];
}
return $doc.createDocumentFragment();
}
