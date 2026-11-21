import { attr, on, text } from 'idlip/server';

export const manifest = { module: '/src/counter.idlip.tsx', events: ['click'], listens: {click: ['add', 'increment', 'reset']}, handlers: { increment: { chunk: 'handler=increment', writes: ['count'], bindings: ['count'] }, add: { chunk: 'handler=add', writes: ['count'], bindings: ['count'] }, reset: { chunk: 'handler=reset', writes: ['count'], bindings: ['count'] } }, groups: { count: { paths: ['count'], chunk: 'binding=count', bindings: ['a0', 't1', 'c2'], covers: [] } }, lists: {} };

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
  '/src/counter.idlip.tsx?idlip-handler=increment&lang.js': '/src/counter.idlip.tsx?idlip-handler=increment&lang.js',
  '/src/counter.idlip.tsx?idlip-handler=add&lang.js': '/src/counter.idlip.tsx?idlip-handler=add&lang.js',
  '/src/counter.idlip.tsx?idlip-handler=reset&lang.js': '/src/counter.idlip.tsx?idlip-handler=reset&lang.js',
  '/src/counter.idlip.tsx?idlip-binding=count&lang.js': '/src/counter.idlip.tsx?idlip-binding=count&lang.js',
};

export default function Counter(props, context, model) {
  const count = model === undefined ? props.start : model.count;
  context.state({ manifest, chunks, model: { count }, props: {} });
  return (
    '<div>' +
    '<button on:click=\'["increment",[]]\'>+1</button>' +
    '<button on:click=\'["add",[10]]\'>+10</button>' +
    `<button${on('click', ['reset', [props.start]])}>Reset</button>` +
    `<output${attr('class', { even: count % 2 === 0 })} i-a="0"><!--t1-->${text(count)}<!--/t--></output>` +
    (count % 2 === 0 ? '<!--c2:0--><span>even</span><!--/c-->' : '<!--c2:1--><!--/c-->') +
    '</div>'
  );
}
