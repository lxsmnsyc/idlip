export function add(model) {
  let { items } = model;
  items = [...items, { id: items.length + 1, n: 3 }];
  return { ...model, items };
}
