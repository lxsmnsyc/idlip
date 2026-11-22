import { clone$, getRows$, putText$ } from 'idlip/helpers';

const templateE2_1$ = { h: '<button on:click=\'["$reset",[2]]\'><!--x1--></button>', n: 1 };
const templateE2_0$ = { h: '<span><!--t6--><!--x1--><!--/t--></span>', n: 1 };
const templateR2$ = { h: '<!--e2:x1--><!--/e-->', n: 1 };

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function render(error, $scope, $doc) {
const $n = clone$(templateE2_1$, $doc);
putText$($n[1], error);
return $n[0];
}

const lists$ = {"5":"items"};

export function region({ model }, start) {
const rows = getRows$(start, model, lists$);
const $doc = start.ownerDocument;
const $n = clone$(templateR2$, $doc);
let $nc1;
try {
const $n2 = clone$(templateE2_0$, $doc);
putText$($n2[1], check(rows[0].item.n));
$nc1 = $n2[0];
$n[1].data += 0;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
const $n3 = clone$(templateE2_1$, $doc);
putText$($n3[1], error);
$nc1 = $n3[0];
$n[1].data += 1;
}
$n[1].after($nc1);
return $n[0];
}
