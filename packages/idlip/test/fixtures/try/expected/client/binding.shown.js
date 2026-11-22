import { clone$, putText$, setBranch$ } from 'idlip/helpers';

const templateE1_0$ = { h: '<b><!--x1--></b>', n: 1 };
const templateE1_1$ = { h: '<em><!--x1--></em>', n: 1 };
const templateC2_0$ = { h: '<!--e1:x1--><!--/e-->', n: 1 };

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function c2(start, { model }) {
setBranch$(start, model.shown ? 0 : 1, renderC2);
}

function renderC2(branch, $doc) {
if (branch === 0) {
const $n = clone$(templateC2_0$, $doc);
let $nc1;
try {
const $n2 = clone$(templateE1_0$, $doc);
putText$($n2[1], check(3));
$nc1 = $n2[0];
$n[1].data += 0;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
const $n3 = clone$(templateE1_1$, $doc);
putText$($n3[1], error);
$nc1 = $n3[0];
$n[1].data += 1;
}
$n[1].after($nc1);
return $n[0];
}
return '<i>hidden</i>';
}
