import { attr, on, text } from 'idlip/server';

function countLeft(todos) {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export const manifest = {
  module: '/src/todo.idlip.tsx',
  events: ['click', 'input', 'keydown', 'submit'],
  handlers: {
    setDraft: { chunk: 'handler=setDraft' },
    clear: { chunk: 'handler=clear' },
    add: { chunk: 'handler=add' },
    toggle: { chunk: 'handler=toggle' },
  },
  groups: {
    'todos.*.done': {
      paths: ['todos.*.done'],
      chunk: 'binding=todos.*.done',
      bindings: ['a4', 'a5'],
      covers: ['todos'],
    },
    'todos.*.id': {
      paths: ['todos.*.id'],
      chunk: 'binding=todos.*.id',
      bindings: ['a7'],
      covers: ['todos'],
    },
    'todos.*.text': {
      paths: ['todos.*.text'],
      chunk: 'binding=todos.*.text',
      bindings: ['t6'],
      covers: ['todos'],
    },
    draft: { paths: ['draft'], chunk: 'binding=draft', bindings: ['a0', 'a1'], covers: [] },
    todos: { paths: ['todos'], chunk: 'binding=todos', bindings: ['t2', 'l3'], covers: [] },
  },
  lists: {
    3: { key: 'id', path: 'todos', chunk: 'list=3', bindings: ['a4', 'a5', 't6', 'a7'] },
  },
};

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
  '/src/todo.idlip.tsx?idlip-handler=setDraft&lang.js': '/src/todo.idlip.tsx?idlip-handler=setDraft&lang.js',
  '/src/todo.idlip.tsx?idlip-handler=clear&lang.js': '/src/todo.idlip.tsx?idlip-handler=clear&lang.js',
  '/src/todo.idlip.tsx?idlip-handler=add&lang.js': '/src/todo.idlip.tsx?idlip-handler=add&lang.js',
  '/src/todo.idlip.tsx?idlip-handler=toggle&lang.js': '/src/todo.idlip.tsx?idlip-handler=toggle&lang.js',
  '/src/todo.idlip.tsx?idlip-binding=todos.*.done&lang.js': '/src/todo.idlip.tsx?idlip-binding=todos.*.done&lang.js',
  '/src/todo.idlip.tsx?idlip-binding=todos.*.id&lang.js': '/src/todo.idlip.tsx?idlip-binding=todos.*.id&lang.js',
  '/src/todo.idlip.tsx?idlip-binding=todos.*.text&lang.js': '/src/todo.idlip.tsx?idlip-binding=todos.*.text&lang.js',
  '/src/todo.idlip.tsx?idlip-binding=draft&lang.js': '/src/todo.idlip.tsx?idlip-binding=draft&lang.js',
  '/src/todo.idlip.tsx?idlip-binding=todos&lang.js': '/src/todo.idlip.tsx?idlip-binding=todos&lang.js',
  '/src/todo.idlip.tsx?idlip-list=3&lang.js': '/src/todo.idlip.tsx?idlip-list=3&lang.js',
};

export default function TodoApp(props, context) {
  const draft = '';
  const todos = props.initial;
  const next = props.initial.length + 1;
  context.state({ manifest, chunks, model: { draft, todos, next }, props: {} });
  let rows = '';
  for (const t of todos) {
    rows +=
      '<!--i-->' +
      `<li${attr('class', { done: t.done })} i-a="4">` +
      `<input type="checkbox"${attr('checked', t.done)}${on('click', ['toggle', [t.id]])} i-a="5 7">` +
      `<!--t6-->${text(t.text)}<!--/t-->` +
      '</li>' +
      '<!--/i-->';
  }
  return (
    '<main>' +
    '<form on:submit=\'["add",[],"prevent"]\'>' +
    `<input${attr('value', draft)} on:input='["setDraft",[["$event","currentTarget","value"]]]' on:keydown='["clear",[],"key:Escape"]' i-a="0">` +
    `<button${attr('disabled', draft === '')} i-a="1">Add</button>` +
    '</form>' +
    `<p><!--t2-->${text(countLeft(todos))}<!--/t--> left</p>` +
    `<ul><!--l3-->${rows}<!--/l--></ul>` +
    '</main>'
  );
}
