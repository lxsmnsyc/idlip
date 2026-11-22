import { setBranch$, text$ } from 'idlip/helpers';

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function c2(start, { model }) {
setBranch$(start, model.shown ? 0 : 1, renderC2);
}

function renderC2(branch) {
if (branch === 0) {
let $try1;
try {
$try1 = `<!--e1:0--><b>${text$(check(3))}</b><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try1 = `<!--e1:1--><em>${text$(error)}</em><!--/e-->`;
}
return $try1;
}
return '<i>hidden</i>';
}
