export function add(model, [step]) {
  let { count } = model;
  count = count + step;
  return { ...model, count };
}

export function $e1($e, $c) {
return [['add', [10]]];
}
