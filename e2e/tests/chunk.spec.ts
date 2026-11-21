import { expect, test } from '@playwright/test';
import getChunkName from '../fixture/chunk.ts';

test('getChunkName reads dev ids and built file names', () => {
  expect(getChunkName('/src/todo.idlip.tsx?idlip-handler=toggle&lang.js')).toBe('handler=toggle');
  expect(getChunkName('/src/todo.idlip.tsx?import&idlip-binding=todos.*.done&lang.js')).toBe(
    'binding=todos.*.done',
  );
  expect(getChunkName('/assets/todo.handler.toggle.OCN4PWUm.js')).toBe('handler=toggle');
  // A hash may hold `-` and `_`.
  expect(getChunkName('/assets/todo.binding.todos._.done.j_y-el90.js')).toBe(
    'binding=todos.*.done',
  );
  expect(getChunkName('/assets/todo.list.3.Dl2IjM7-.js')).toBe('list=3');
  expect(getChunkName('/assets/todo.handler.set-Draft.-abc_123.js')).toBe('handler=set-Draft');
  expect(getChunkName('/assets/counter.source.idle.Afm-GCnA.js')).toBe('source=idle');
  expect(getChunkName('/assets/todo.task.save.Afm-GCnA.js')).toBe('task=save');
  expect(getChunkName('/assets/counter.view.CXUOfqUo.js')).toBe('view');
  expect(getChunkName('/assets/counter.idlip.tsx_idlip-view_lang.DncCKmVA.js')).toBe('view');
  expect(getChunkName('/src/counter.idlip.tsx?idlip-view&lang.js')).toBe('view');
  expect(getChunkName('/assets/loader.CinWKtZa.js')).toBeUndefined();
  expect(getChunkName('/')).toBeUndefined();
});
