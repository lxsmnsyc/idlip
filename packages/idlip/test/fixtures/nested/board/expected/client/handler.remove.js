export function remove(model, [id]) {
  let { items } = model;
  items = items.filter((item) => item.id !== id);
  return { ...model, items };
}
