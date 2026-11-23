export function toggle(model) {
  let { shown } = model;
  shown = !shown;
  return { ...model, shown };
}

export function $e1($e, $c) {
return [['toggle', []]];
}
