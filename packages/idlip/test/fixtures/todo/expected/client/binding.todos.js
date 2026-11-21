import { setText } from 'idlip/client';

function countLeft(todos) {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export function t2(start, { model }) {
  setText(start, countLeft(model.todos));
}

export function l3({ model }) {
  return model.todos;
}
