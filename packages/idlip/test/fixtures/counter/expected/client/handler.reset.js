export function reset(model, [props$start]) {
  let { count } = model;
  count = props$start;
  return { ...model, count };
}
