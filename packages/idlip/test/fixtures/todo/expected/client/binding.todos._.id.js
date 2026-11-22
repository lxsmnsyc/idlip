import { setOn$, setText$ } from 'idlip/helpers';

function countLeft(todos) {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export function a7(el, { rows }) {
setOn$(el, 'click', ['toggle', [rows[0].item.id]]);
}

// Covers `todos`.
export function t2(start, { model }) {
setText$(start, countLeft(model.todos));
}

export function l3({ model }) {
return model.todos;
}
