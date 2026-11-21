export function rename(model, [prefix]) {
  let { todos, label } = model;
  const first = todos.length;
  return {
    model: { ...model, label },
    task: { site: 'rename$1', args: [prefix, todos.length], then: 'rename$1', carried: [first] },
  };
}

export function rename$1(model, [$outcome, first]) {
  let { todos, label } = model;
  if (!$outcome.ok) {
    throw $outcome.error;
  }
  const name = $outcome.value;
  return {
    model: { ...model, label },
    task: { site: 'rename$2', args: [name, first], then: 'rename$2', carried: [name, first] },
  };
}

export function rename$2(model, [$outcome, name, first]) {
  let { todos, label } = model;
  if (!$outcome.ok) {
    throw $outcome.error;
  }
  const second = $outcome.value;
  label = `${name}:${second}:${first}`;
  return { ...model, label };
}
