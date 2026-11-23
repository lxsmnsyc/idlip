export function increment(model) {
  let { count } = model;
  count = count + 1;
  return { ...model, count };
}

export function $e0($e, $c) {
return [['increment', []]];
}
