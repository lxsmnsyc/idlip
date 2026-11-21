/* oxlint-disable */
// Stub of the resume loader until `resume-loader` and `patch-bindings` ship.
import 'idlip/client';

const boot = self.$idlip;
const queue = boot.q;
let page;
let chain = Promise.resolve();

function loadChunk(chunk) {
  const id = `${page.manifest.module}?idlip-${chunk}&lang.js`;
  return import(page.chunks[id]);
}

function isChanged(prev, next, segments) {
  if (prev === next) {
    return false;
  }
  if (segments.length === 0) {
    return true;
  }
  const [segment, ...rest] = segments;
  if (segment !== '*') {
    return isChanged(prev?.[segment], next?.[segment], rest);
  }
  const before = prev ?? [];
  const after = next ?? [];
  if (before.length !== after.length) {
    return true;
  }
  for (const [index, item] of before.entries()) {
    if (isChanged(item, after[index], rest)) {
      return true;
    }
  }
  return false;
}

function selectGroups(prev, next) {
  const chosen = [];
  const covered = new Set();
  for (const [key, group] of Object.entries(page.manifest.groups)) {
    for (const path of group.paths) {
      if (isChanged(prev, next, path.split('.'))) {
        chosen.push(key);
        for (const cover of group.covers) {
          covered.add(cover);
        }
        break;
      }
    }
  }
  return chosen.filter((key) => !covered.has(key));
}

function findComments(name) {
  const found = [];
  const walker = document.createTreeWalker(page.root, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.data === name) {
      found.push(node);
    }
  }
  return found;
}

function findRowIndex(element, listId) {
  const [start] = findComments(listId);
  let row = element;
  while (row.parentNode !== start.parentNode) {
    row = row.parentNode;
  }
  // The row's own `<!--i-->` marker comes first.
  let index = -1;
  for (let node = row.previousSibling; node !== start; node = node.previousSibling) {
    if (node.nodeType === 8 && node.data === 'i') {
      index++;
    }
  }
  return index;
}

function getRows(element, id, model) {
  const rows = [];
  for (const [listId, list] of Object.entries(page.manifest.lists)) {
    if (list.bindings.includes(id)) {
      const index = findRowIndex(element, `l${listId}`);
      rows.push({ item: model[list.path][index], index });
    }
  }
  return rows;
}

function patchBinding(chunk, id, model) {
  if (id.startsWith('t')) {
    for (const start of findComments(id)) {
      chunk[id](start, { model, props: page.props, rows: [] });
    }
  } else if (id.startsWith('a')) {
    for (const element of page.root.querySelectorAll('[i-a]')) {
      if (element.getAttribute('i-a').split(' ').includes(id.slice(1))) {
        chunk[id](element, { model, props: page.props, rows: getRows(element, id, model) });
      }
    }
  }
}

async function patch(prev, next) {
  for (const key of selectGroups(prev, next)) {
    const group = page.manifest.groups[key];
    const chunk = await loadChunk(group.chunk);
    const ids = [...group.bindings];
    for (const cover of group.covers) {
      ids.push(...page.manifest.groups[cover].bindings);
    }
    for (const id of ids) {
      patchBinding(chunk, id, next);
    }
  }
}

async function handle({ message }) {
  // The state decodes on the first event only.
  page ||= { ...boot[0][1](), root: document.body };
  const handler = await loadChunk(page.manifest.handlers[message.t].chunk);
  const prev = page.model;
  page.model = handler[message.t](prev, message.p);
  await patch(prev, page.model);
}

function run(event) {
  chain = chain.then(() => handle(event));
}

// Take over the queue: drain it, then handle later events directly.
for (const event of queue.splice(0)) {
  run(event);
}
queue.push = (...events) => {
  for (const event of events) {
    run(event);
  }
  return queue.length;
};
