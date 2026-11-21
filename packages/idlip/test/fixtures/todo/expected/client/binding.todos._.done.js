function getText$(value) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  return String(value);
}

function joinClass$(value) {
  const names = [];
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled) {
      names.push(name);
    }
  }
  return names.join(' ');
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

function setAttr$(el, name, value) {
  if (name === 'value' || name === 'checked' || name === 'selected') {
    Reflect.set(el, name, name === 'value' ? getText$(value) : Boolean(value));
    return;
  }
  if (value === false || value === null || value === undefined) {
    el.removeAttribute(name);
  } else if (typeof value === 'object') {
    const names = joinClass$(value);
    if (names === '') {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, names);
    }
  } else {
    el.setAttribute(name, value === true ? '' : getText$(value));
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

export function a4(el, { rows }) {
  setAttr$(el, 'class', { done: rows[0].item.done });
}

export function a5(el, { rows }) {
  setAttr$(el, 'checked', rows[0].item.done);
}

// Covers `todos`.
export function t2(start, { model }) {
  setText$(start, countLeft(model.todos));
}

export function l3({ model }) {
  return model.todos;
}
