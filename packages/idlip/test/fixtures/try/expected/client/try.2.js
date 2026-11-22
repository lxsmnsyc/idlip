import { getRows$, text$ } from 'idlip/helpers';

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function render(error) {
return `<button on:click='["$reset",[2]]'>${text$(error)}</button>`;
}

const lists$ = {"5":"items"};

export function region({ model }, start) {
const rows = getRows$(start, model, lists$);
let $try2;
try {
$try2 = `<!--e2:0--><span><!--t6-->${text$(check(rows[0].item.n))}<!--/t--></span><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try2 = `<!--e2:1--><button on:click='["$reset",[2]]'>${text$(error)}</button><!--/e-->`;
}
return $try2;
}
