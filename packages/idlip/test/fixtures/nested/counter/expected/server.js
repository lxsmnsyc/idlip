import { on, text } from 'idlip/server';

export const manifest = { module: '/src/counter.tsx', events: ['click'], listens: {click: ['increment']}, handlers: { increment: { chunk: 'handler=increment', writes: ['count'], bindings: ['count'] }, $e0: { chunk: 'handler=increment', bindings: ['count'], tags: ['increment'] } }, groups: { 'props.label': { paths: ['props.label'], chunk: 'binding=props.label', bindings: ['a0'], covers: [] }, 'props.onRemove': { paths: ['props.onRemove'], chunk: 'binding=props.onRemove', bindings: ['a2'], covers: [] }, count: { paths: ['count'], chunk: 'binding=count', bindings: ['a1'], covers: [] } }, lists: {}, view: { chunk: 'view' } };

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
  '/src/counter.tsx?idlip-handler=increment&lang.js': '/src/counter.tsx?idlip-handler=increment&lang.js',
  '/src/counter.tsx?idlip-binding=props.label&lang.js': '/src/counter.tsx?idlip-binding=props.label&lang.js',
  '/src/counter.tsx?idlip-binding=props.onRemove&lang.js': '/src/counter.tsx?idlip-binding=props.onRemove&lang.js',
  '/src/counter.tsx?idlip-binding=count&lang.js': '/src/counter.tsx?idlip-binding=count&lang.js',
  '/src/counter.tsx?idlip-view&lang.js': '/src/counter.tsx?idlip-view&lang.js',
};

// `path` is the model path of this component: absent for the root, the slot path for a child.
// `context.state` records the state under it.
export default function Counter(props, context, model, path) {
  const count = model === undefined ? 0 : model.count;
  context.state(
    { manifest, chunks, model: { count }, props: { label: props.label, onRemove: props.onRemove } },
    path,
  );
  return (
    '<div>' +
    `<span i-a="0">${text(props.label)}</span>` +
    '<button on:click="$e0">+</button>' +
    `<output i-a="1">${text(count)}</output>` +
    `<button${on('click', props.onRemove)} i-a="2">Remove</button>` +
    '</div>'
  );
}
