function getText$(value) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  return String(value);
}

function setText$(start, value) {
  const text = getText$(value);
  if (start.nodeType === 1) {
    if (start.textContent !== text) {
      start.textContent = text;
    }
    return;
  }
  const first = start.nextSibling;
  if (first?.nodeType === 3) {
    if (first.nodeValue !== text) {
      first.nodeValue = text;
    }
  } else if (text !== '') {
    start.parentNode?.insertBefore(start.ownerDocument.createTextNode(text), first);
  }
}

function countLeft(todos) {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export function t6(start, { rows }) {
  setText$(start, rows[0].item.text);
}

// Covers `todos`.
export function t2(start, { model }) {
  setText$(start, countLeft(model.todos));
}

export function l3({ model }) {
  return model.todos;
}
