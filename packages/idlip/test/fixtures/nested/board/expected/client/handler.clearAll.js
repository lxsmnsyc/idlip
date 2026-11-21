export function clearAll(model) {
  let { items } = model;
  items = [];
  return { ...model, items };
}
