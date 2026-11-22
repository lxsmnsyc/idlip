import { text$ } from 'idlip/helpers';

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function render({ rows }) {
const item = rows[0].item;
let $try2;
try {
$try2 = `<!--e2:0--><span><!--t6-->${text$(check(item.n))}<!--/t--></span><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try2 = `<!--e2:1--><button on:click='["$reset",[2]]'>${text$(error)}</button><!--/e-->`;
}
return `<li>${$try2}</li>`;
}
