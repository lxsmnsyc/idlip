import { clone$, putText$ } from 'idlip/helpers';

const templateE2_0$ = { h: '<span i-a="6"><!--x1--></span>', n: 1 };
const templateE2_1$ = { h: '<button on:click=\'["$reset",[2]]\'><!--x1--></button>', n: 1 };
const templateL5$ = { h: '<!--i--><li><!--e2:x1--><!--/e--></li><!--/i-->', n: 1 };

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function render({ rows }, $doc) {
const item = rows[0].item;
const $n = clone$(templateL5$, $doc);
let $nc1;
try {
const $n2 = clone$(templateE2_0$, $doc);
putText$($n2[1], check(item.n));
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
