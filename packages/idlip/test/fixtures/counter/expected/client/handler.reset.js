export function reset(model, [props$start]) {
  let { count } = model;
  count = props$start;
  return { ...model, count };
}

export function $e2($e, $c, { page: { props } }) {
return [['reset', [props.start]]];
}
