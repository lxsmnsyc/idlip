import { setAttr, setText } from 'idlip/client';

function countLeft(todos) {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export function a4(el, { rows }) {
  setAttr(el, 'class', { done: rows[0].item.done });
}

export function a5(el, { rows }) {
  setAttr(el, 'checked', rows[0].item.done);
}

// Covers `todos`.
export function t2(start, { model }) {
  setText(start, countLeft(model.todos));
}

export function l3({ model }) {
  return model.todos;
}
