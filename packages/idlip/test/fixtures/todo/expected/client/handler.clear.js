export function clear(model) {
  let { draft } = model;
  draft = '';
  return { ...model, draft };
}

export function $e2($e, $c) {
return [['clear', []]];
}
