export function clear(model) {
  let { draft } = model;
  draft = '';
  return { ...model, draft };
}
