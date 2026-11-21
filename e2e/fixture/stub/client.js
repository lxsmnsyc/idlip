/* oxlint-disable */
// Stub of the `idlip/client` helpers until `patch-bindings` ships the real ones.
function joinClass(value) {
  const names = [];
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled) {
      names.push(name);
    }
  }
  return names.join(' ');
}

export function setAttr(element, name, value) {
  const text = typeof value === 'object' && value !== null ? joinClass(value) : value;
  if (typeof value === 'boolean' && name in element) {
    element[name] = value;
  }
  if (text === false || text === '' || text === null || text === undefined) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, text === true ? '' : String(text));
  }
}

export function setText(start, value) {
  let node = start.nextSibling;
  while (node !== null && !(node.nodeType === 8 && node.data === '/t')) {
    const next = node.nextSibling;
    node.remove();
    node = next;
  }
  start.after(document.createTextNode(String(value)));
}

export function attr() {
  return '';
}

export function on() {
  return '';
}

export function text(value) {
  return String(value);
}
