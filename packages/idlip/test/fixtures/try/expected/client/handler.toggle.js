export function toggle(model) {
  let { shown } = model;
  shown = !shown;
  return { ...model, shown };
}
