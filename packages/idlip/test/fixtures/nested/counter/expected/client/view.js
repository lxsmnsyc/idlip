import { clone$, putText$, setOn$ } from 'idlip/helpers';

const templateV$ = { h: '<div><span i-a="0"><!--x1--></span><button on:click=\'["increment",[]]\'>+</button><output i-a="1"><!--x2--></output><button i-x="3" i-a="2">Remove</button></div>', n: 3 };

// The initial model, from the state initializers and the props.
export function init() {
return { count: 0 };
}

// The whole view without the boundary markers, which the parent's template writes.
export function render({ model, props }, $doc) {
const { count } = model;
const $n = clone$(templateV$, $doc);
putText$($n[1], props.label);
putText$($n[2], count);
setOn$($n[3], 'click', props.onRemove);
return $n[0];
}
