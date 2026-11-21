import { attr as attr$, on as on$, text as text$ } from 'idlip/server';

export const manifest = { module: '/src/effects.idlip.tsx', events: ['click', 'input'], listens: {click: ['add', 'persist', 'rename'], input: ['setDraft']}, handlers: { setDraft: { chunk: 'handler=setDraft', writes: ['draft'], bindings: ['draft'] }, add: { chunk: 'handler=add', writes: ['todos', 'draft'], bindings: ['draft'] }, add$1: { chunk: 'handler=add', writes: ['todos', 'draft'], bindings: ['draft'] }, persist: { chunk: 'handler=persist', writes: ['save', 'saved', 'label'], bindings: ['save.state', 'label', 'saved'] }, persist$1: { chunk: 'handler=persist', writes: ['save', 'saved', 'label'], bindings: ['save.state', 'label', 'saved'] }, rename: { chunk: 'handler=rename', writes: ['label'], bindings: ['label'] }, rename$1: { chunk: 'handler=rename', writes: ['label'], bindings: ['label'] }, rename$2: { chunk: 'handler=rename', writes: ['label'], bindings: ['label'] } }, tasks: { add$1: 'task=add$1', persist$1: 'task=persist$1', rename$1: 'task=rename$1', rename$2: 'task=rename$2' }, groups: { 'save.state': { paths: ['save.state'], chunk: 'binding=save.state', bindings: ['t3'], covers: [] }, draft: { paths: ['draft'], chunk: 'binding=draft', bindings: ['a0'], covers: [] }, label: { paths: ['label'], chunk: 'binding=label', bindings: ['t1'], covers: [] }, saved: { paths: ['saved'], chunk: 'binding=saved', bindings: ['t2'], covers: [] } }, lists: {} };

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
'/src/effects.idlip.tsx?idlip-handler=setDraft&lang.js': '/src/effects.idlip.tsx?idlip-handler=setDraft&lang.js',
'/src/effects.idlip.tsx?idlip-handler=add&lang.js': '/src/effects.idlip.tsx?idlip-handler=add&lang.js',
'/src/effects.idlip.tsx?idlip-handler=persist&lang.js': '/src/effects.idlip.tsx?idlip-handler=persist&lang.js',
'/src/effects.idlip.tsx?idlip-handler=rename&lang.js': '/src/effects.idlip.tsx?idlip-handler=rename&lang.js',
'/src/effects.idlip.tsx?idlip-task=add$1&lang.js': '/src/effects.idlip.tsx?idlip-task=add$1&lang.js',
'/src/effects.idlip.tsx?idlip-task=persist$1&lang.js': '/src/effects.idlip.tsx?idlip-task=persist$1&lang.js',
'/src/effects.idlip.tsx?idlip-task=rename$1&lang.js': '/src/effects.idlip.tsx?idlip-task=rename$1&lang.js',
'/src/effects.idlip.tsx?idlip-task=rename$2&lang.js': '/src/effects.idlip.tsx?idlip-task=rename$2&lang.js',
'/src/effects.idlip.tsx?idlip-binding=save.state&lang.js': '/src/effects.idlip.tsx?idlip-binding=save.state&lang.js',
'/src/effects.idlip.tsx?idlip-binding=draft&lang.js': '/src/effects.idlip.tsx?idlip-binding=draft&lang.js',
'/src/effects.idlip.tsx?idlip-binding=label&lang.js': '/src/effects.idlip.tsx?idlip-binding=label&lang.js',
'/src/effects.idlip.tsx?idlip-binding=saved&lang.js': '/src/effects.idlip.tsx?idlip-binding=saved&lang.js',
};

export default function Effects(props, context, model) {
const draft = model === undefined ? '' : model.draft;
const todos = model === undefined ? [] : model.todos;
const save = model === undefined ? { state: 'idle' } : model.save;
const label = model === undefined ? '' : model.label;
const saved = model === undefined ? 0 : model.saved;
context.state({ manifest, chunks, model: { draft, todos, save, label, saved }, props: {} });
return `<main><input${attr$('value', draft)} on:input='["setDraft",[["$event","currentTarget","value"]]]' i-a="0"><button on:click='["add",[]]'>Add</button><button${on$('click', ['persist', [props.step]])}>Save</button><button on:click='["rename",["todo"]]'>Rename</button><p><!--t1-->${text$(label)}<!--/t--></p><p><!--t2-->${text$(saved)}<!--/t--></p><p><!--t3-->${text$(save.state)}<!--/t--></p></main>`;
}
