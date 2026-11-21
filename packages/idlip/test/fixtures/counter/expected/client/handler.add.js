export function add(model, [step]) {
  let { count } = model;
  count = count + step;
  return { ...model, count };
}
