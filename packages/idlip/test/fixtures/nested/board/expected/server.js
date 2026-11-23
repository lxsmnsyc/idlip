import { slot, text } from 'idlip/server';
// The compiler keeps the specifier of the source. This one has an extra `../` for the `expected` folder.
import * as Counter from '../../counter/counter.tsx';

export const manifest = { module: '/src/board.tsx', events: [], handlers: { remove: { chunk: 'handler=remove', writes: ['items'], bindings: ['items.*.id', 'items.*.label', 'items.length'] }, clearAll: { chunk: 'handler=clearAll', writes: ['items'], bindings: ['items.*.id', 'items.*.label', 'items.length'] } }, groups: { 'items.*.id': { paths: ['items.*.id'], chunk: 'binding=items.*.id', bindings: ['p4'], covers: ['items'] }, 'items.*.label': { paths: ['items.*.label'], chunk: 'binding=items.*.label', bindings: ['p3'], covers: ['items'] }, 'items.length': { paths: ['items.length'], chunk: 'binding=items.length', bindings: ['t0'], covers: ['items'] }, items: { paths: ['items'], chunk: 'binding=items', bindings: ['l2'], covers: [] } }, lists: { 2: { key: 'id', path: 'items', chunk: 'list=2', bindings: ['p3', 'p4'] } } };

// `vite-plugin` replaces the URLs in a build.
export const chunks = {
  '/src/board.tsx?idlip-handler=remove&lang.js': '/src/board.tsx?idlip-handler=remove&lang.js',
  '/src/board.tsx?idlip-handler=clearAll&lang.js': '/src/board.tsx?idlip-handler=clearAll&lang.js',
  '/src/board.tsx?idlip-binding=items.*.id&lang.js': '/src/board.tsx?idlip-binding=items.*.id&lang.js',
  '/src/board.tsx?idlip-binding=items.*.label&lang.js': '/src/board.tsx?idlip-binding=items.*.label&lang.js',
  '/src/board.tsx?idlip-binding=items.length&lang.js': '/src/board.tsx?idlip-binding=items.length&lang.js',
  '/src/board.tsx?idlip-binding=items&lang.js': '/src/board.tsx?idlip-binding=items&lang.js',
  '/src/board.tsx?idlip-list=2&lang.js': '/src/board.tsx?idlip-list=2&lang.js',
};

// The server modules of the stateful children, so `render()` can write their manifests and
// chunk URLs, also for children that no row renders yet.
export const uses = [Counter];

export default function Board(props, context, model, path = '') {
  const items = model === undefined ? props.items : model.items;
  context.state({ manifest, chunks, uses, model: { items }, props: {} }, path);
  const spare = slot(path, 0);
  const spareHtml = Counter.default(
    { label: 'Spare', onRemove: ['clearAll', [], '', path] },
    context,
    context.slots?.[spare]?.model,
    spare,
  );
  let rows = '';
  for (const c of items) {
    const child = slot(path, 1, c.id);
    rows +=
      '<!--i-->' +
      `<!--n:${child}-->` +
      Counter.default(
        { label: c.label, onRemove: ['remove', [c.id], '', path] },
        context,
        context.slots?.[child]?.model,
        child,
      ) +
      '<!--/n-->' +
      '<!--/i-->';
  }
  return (
    '<section>' +
    `<p><!--t0-->${text(items.length)}<!--/t--> counters</p>` +
    `<!--n:${spare}-->${spareHtml}<!--/n-->` +
    `<!--l2-->${rows}<!--/l-->` +
    '</section>'
  );
}
