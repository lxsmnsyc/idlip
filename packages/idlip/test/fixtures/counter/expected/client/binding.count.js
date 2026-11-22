import {
  addBlock as addBlock$,
  findInnerBlocks as findInnerBlocks$,
  parseHtml as parseHtml$,
  removeBlock as removeBlock$,
} from 'idlip/client';

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

function findEnd$(start) {
  let depth = 0;
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    if (node.nodeType !== 8) {
      continue;
    }
    if (node.nodeValue === '/c') {
      if (depth === 0) {
        return node;
      }
      depth--;
    } else if (/^c\d/.test(node.nodeValue ?? '')) {
      depth++;
    }
  }
  return null;
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

function setBranch$(start, branch, render, ns) {
  const colon = start.data.indexOf(':');
  const end = findEnd$(start);
  const parent = start.parentNode;
  if (start.data.slice(colon + 1) === String(branch) || end === null || parent === null) {
    return;
  }
  for (const block of findInnerBlocks$(start, end)) {
    removeBlock$(block);
  }
  removeBlock$(start);
  while (start.nextSibling !== end) {
    start.nextSibling?.remove();
  }
  const html = render(branch);
  for (const node of typeof html === 'string' ? parseHtml$(start.ownerDocument, html, ns) : [html]) {
    parent.insertBefore(node, end);
  }
  start.data = `${start.data.slice(0, colon + 1)}${branch}`;
  for (const block of findInnerBlocks$(start, end)) {
    addBlock$(block);
  }
  addBlock$(start);
}

export function a0(el, { model }) {
  setAttr$(el, 'class', { even: model.count % 2 === 0 });
}

export function t1(start, { model }) {
  setText$(start, model.count);
}

export function c2(start, { model }) {
  setBranch$(start, model.count % 2 === 0 ? 0 : 1, renderC2);
}

function renderC2(branch) {
  return branch === 0 ? '<span>even</span>' : '';
}
