import { text as text$ } from 'idlip/server';

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export const manifest = { module: '/src/board.tsx', events: ['click'], listens: { click: ['add', 'toggle'] }, handlers: { add: { chunk: 'handler=add', writes: ['items'], bindings: ['items.*.n'] }, toggle: { chunk: 'handler=toggle', writes: ['shown'], bindings: ['shown'] }, $e0: { chunk: 'handler=add', bindings: ['items.*.n'], tags: ['add'] }, $e1: { chunk: 'handler=toggle', bindings: ['shown'], tags: ['toggle'] } }, fallback: { 0: 'try=0', 1: 'try=1', 2: 'try=2' }, groups: { 'items.*.n': { paths: ['items.*.n'], chunk: 'binding=items.*.n', bindings: ['a6'], covers: ['items'] }, items: { paths: ['items'], chunk: 'binding=items', bindings: ['l5'], covers: [] }, shown: { paths: ['shown'], chunk: 'binding=shown', bindings: ['c2'], covers: [] } }, lists: { 5: { key: 'id', path: 'items', chunk: 'list=5', bindings: ['a6'] } } };

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
'/src/board.tsx?idlip-handler=add&lang.js': '/src/board.tsx?idlip-handler=add&lang.js',
'/src/board.tsx?idlip-handler=toggle&lang.js': '/src/board.tsx?idlip-handler=toggle&lang.js',
'/src/board.tsx?idlip-binding=items.*.n&lang.js': '/src/board.tsx?idlip-binding=items.*.n&lang.js',
'/src/board.tsx?idlip-binding=items&lang.js': '/src/board.tsx?idlip-binding=items&lang.js',
'/src/board.tsx?idlip-binding=shown&lang.js': '/src/board.tsx?idlip-binding=shown&lang.js',
'/src/board.tsx?idlip-list=5&lang.js': '/src/board.tsx?idlip-list=5&lang.js',
'/src/board.tsx?idlip-try=0&lang.js': '/src/board.tsx?idlip-try=0&lang.js',
'/src/board.tsx?idlip-try=1&lang.js': '/src/board.tsx?idlip-try=1&lang.js',
'/src/board.tsx?idlip-try=2&lang.js': '/src/board.tsx?idlip-try=2&lang.js',
};

export default function Board(props, context, model) {
const items = model === undefined ? [{ id: 1, n: -1 }, { id: 2, n: 2 }] : model.items;
const shown = model === undefined ? true : model.shown;
context.state({ manifest, chunks, model: { items, shown }, props: {} });
let $try0;
try {
$try0 = `<!--e0:0--><span>${text$(check(-1))}</span><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try0 = `<!--e0:1--><p>Failed: ${text$(error)} <button on:click='["$reset",[0]]'>Retry</button></p><!--/e-->`;
}
let $rows = '';
for (const item of items) {
let $try2;
try {
$try2 = `<!--e2:0--><span i-a="6">${text$(check(item.n))}</span><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try2 = `<!--e2:1--><button on:click='["$reset",[2]]'>${text$(error)}</button><!--/e-->`;
}
$rows += `<!--i--><li>${$try2}</li><!--/i-->`;
}
return `<main>${$try0}${(shown ? (() => {
let $try1;
try {
$try1 = `<!--e1:0--><b>${text$(check(3))}</b><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try1 = `<!--e1:1--><em>${text$(error)}</em><!--/e-->`;
}
return `<!--c2:0-->${$try1}<!--/c-->`;
})() : '<!--c2:1--><i>hidden</i><!--/c-->')}<ul><!--l5-->${$rows}<!--/l--></ul><button on:click="$e0">add</button><button on:click="$e1">toggle</button></main>`;
}
