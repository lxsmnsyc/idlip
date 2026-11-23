import { attr as attr$, text as text$ } from 'idlip/server';

function countLeft(todos) {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export const manifest = { module: '/src/todo.tsx', events: ['click', 'input', 'keydown', 'submit'], listens: { click: ['toggle'], input: ['setDraft'], keydown: ['clear'], submit: ['add'] }, handlers: { setDraft: { chunk: 'handler=setDraft', writes: ['draft'], bindings: ['draft'] }, clear: { chunk: 'handler=clear', writes: ['draft'], bindings: ['draft'] }, add: { chunk: 'handler=add', writes: ['todos', 'next', 'draft'], bindings: ['todos.*.done', 'todos.*.text', 'draft'] }, toggle: { chunk: 'handler=toggle', writes: ['todos.*.done'], bindings: ['todos.*.done'] } }, sites: { $e0: { chunk: 'handler=add', bindings: ['todos.*.done', 'todos.*.text', 'draft'], tags: ['add'] }, $e1: { chunk: 'handler=setDraft', bindings: ['draft'], tags: ['setDraft'] }, $e2: { chunk: 'handler=clear', bindings: ['draft'], tags: ['clear'] }, $e3: { chunk: 'handler=toggle', bindings: ['todos.*.done'], tags: ['toggle'] } }, groups: { 'todos.*.done': { paths: ['todos.*.done'], chunk: 'binding=todos.*.done', bindings: ['a4', 'a5'], covers: ['todos'] }, 'todos.*.text': { paths: ['todos.*.text'], chunk: 'binding=todos.*.text', bindings: ['t6'], covers: ['todos'] }, draft: { paths: ['draft'], chunk: 'binding=draft', bindings: ['a0', 'a1'], covers: [] }, todos: { paths: ['todos'], chunk: 'binding=todos', bindings: ['t2', 'l3'], covers: [] } }, lists: { 3: { key: 'id', path: 'todos', chunk: 'list=3', bindings: ['a4', 'a5', 't6'] } } };

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
'/src/todo.tsx?idlip-handler=setDraft&lang.js': '/src/todo.tsx?idlip-handler=setDraft&lang.js',
'/src/todo.tsx?idlip-handler=clear&lang.js': '/src/todo.tsx?idlip-handler=clear&lang.js',
'/src/todo.tsx?idlip-handler=add&lang.js': '/src/todo.tsx?idlip-handler=add&lang.js',
'/src/todo.tsx?idlip-handler=toggle&lang.js': '/src/todo.tsx?idlip-handler=toggle&lang.js',
'/src/todo.tsx?idlip-binding=todos.*.done&lang.js': '/src/todo.tsx?idlip-binding=todos.*.done&lang.js',
'/src/todo.tsx?idlip-binding=todos.*.text&lang.js': '/src/todo.tsx?idlip-binding=todos.*.text&lang.js',
'/src/todo.tsx?idlip-binding=draft&lang.js': '/src/todo.tsx?idlip-binding=draft&lang.js',
'/src/todo.tsx?idlip-binding=todos&lang.js': '/src/todo.tsx?idlip-binding=todos&lang.js',
'/src/todo.tsx?idlip-list=3&lang.js': '/src/todo.tsx?idlip-list=3&lang.js',
};

export default function TodoApp(props, context, model) {
const draft = model === undefined ? '' : model.draft;
const todos = model === undefined ? props.initial : model.todos;
const next = model === undefined ? props.initial.length + 1 : model.next;
context.state({ manifest, chunks, model: { draft, todos, next }, props: {} });
let $rows = '';
for (const t of todos) {
$rows += `<!--i--><li${attr$('class', { done: t.done })} i-a="4"><input type="checkbox"${attr$('checked', t.done)} on:click="$e3" i-a="5"><!--t6-->${text$(t.text)}<!--/t--></li><!--/i-->`;
}
return `<main><form on:submit="$e0 prevent"><input${attr$('value', draft)} on:input="$e1" on:keydown="$e2 key:Escape" i-a="0"><button${attr$('disabled', draft === '')} i-a="1">Add</button></form><p><!--t2-->${text$(countLeft(todos))}<!--/t--> left</p><ul><!--l3-->${$rows}<!--/l--></ul></main>`;
}
