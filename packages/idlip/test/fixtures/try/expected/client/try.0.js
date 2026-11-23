import { clone$, putText$ } from 'idlip/helpers';

const templateE0_1$ = { h: '<p>Failed: <!--x1--> <button on:click=\'["$reset",[0]]\'>Retry</button></p>', n: 1 };
const templateE0_0$ = { h: '<span><!--x1--></span>', n: 1 };
const templateR0$ = { h: '<!--e0:x1--><!--/e-->', n: 1 };

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function render(error, $scope, $doc) {
const $n = clone$(templateE0_1$, $doc);
putText$($n[1], error);
return $n[0];
}

export function region($scope, start) {
const $doc = start.ownerDocument;
const $n = clone$(templateR0$, $doc);
let $nc1;
try {
const $n2 = clone$(templateE0_0$, $doc);
putText$($n2[1], check(-1));
$nc1 = $n2[0];
$n[1].data += 0;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
const $n3 = clone$(templateE0_1$, $doc);
putText$($n3[1], error);
$nc1 = $n3[0];
$n[1].data += 1;
}
$n[1].after($nc1);
return $n[0];
}
