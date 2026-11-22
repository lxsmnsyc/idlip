import { on$, text$ } from 'idlip/helpers';

// The initial model, from the state initializers and the props.
export function init() {
return { count: 0 };
}

// The whole view without the boundary markers, which the parent's template writes.
export function render({ model, props }) {
const { count } = model;
return `<div><span><!--t0-->${text$(props.label)}<!--/t--></span><button on:click='["increment",[]]'>+</button><output><!--t1-->${text$(count)}<!--/t--></output><button${on$('click', props.onRemove)} i-a="2">Remove</button></div>`;
}
