import { attr as attr$, text as text$ } from 'idlip/server';

export const manifest = { module: '/src/counter.tsx', events: ['click'], listens: { click: ['add', 'increment', 'reset'] }, handlers: { increment: { chunk: 'handler=increment', writes: ['count'], bindings: ['count'] }, add: { chunk: 'handler=add', writes: ['count'], bindings: ['count'] }, reset: { chunk: 'handler=reset', writes: ['count'], bindings: ['count'] }, $e0: { chunk: 'handler=increment', bindings: ['count'], tags: ['increment'] }, $e1: { chunk: 'handler=add', bindings: ['count'], tags: ['add'] }, $e2: { chunk: 'handler=reset', bindings: ['count'], tags: ['reset'] } }, groups: { count: { paths: ['count'], chunk: 'binding=count', bindings: ['a0', 'a1', 'c2'], covers: [] } }, lists: {} };

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
'/src/counter.tsx?idlip-handler=increment&lang.js': '/src/counter.tsx?idlip-handler=increment&lang.js',
'/src/counter.tsx?idlip-handler=add&lang.js': '/src/counter.tsx?idlip-handler=add&lang.js',
'/src/counter.tsx?idlip-handler=reset&lang.js': '/src/counter.tsx?idlip-handler=reset&lang.js',
'/src/counter.tsx?idlip-binding=count&lang.js': '/src/counter.tsx?idlip-binding=count&lang.js',
};

export default function Counter(props, context, model) {
const count = model === undefined ? props.start : model.count;
context.state({ manifest, chunks, model: { count }, props: { start: props.start } });
return `<div><button on:click="$e0">+1</button><button on:click="$e1">+10</button><button on:click="$e2">Reset</button><output${attr$('class', { even: count % 2 === 0 })} i-a="0 1">${text$(count)}</output>${(count % 2 === 0 ? '<!--c2:0--><span>even</span><!--/c-->' : '<!--c2:1--><!--/c-->')}</div>`;
}
