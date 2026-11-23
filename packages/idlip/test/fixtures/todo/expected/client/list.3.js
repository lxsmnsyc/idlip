import { clone$, putAttr$, putText$ } from 'idlip/helpers';

const templateL3$ = { h: '<!--i--><li i-x="1" i-a="4"><input i-x="2" type="checkbox" on:click="$e3" i-a="5"><!--t6--><!--x3--><!--/t--></li><!--/i-->', n: 3 };

export function render({ rows }, $doc) {
const t = rows[0].item;
const $n = clone$(templateL3$, $doc);
putAttr$($n[1], 'class', { done: t.done });
putAttr$($n[2], 'checked', t.done);
putText$($n[3], t.text);
return $n[0];
}
