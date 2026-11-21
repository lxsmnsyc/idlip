export function persist(model, [props$step]) {
  let { todos, save, label, saved } = model;
  save = { state: 'saving' };
  try {
    return {
      model: { ...model, save, label, saved },
      task: { site: 'persist$1', args: [todos], then: 'persist$1', carried: [props$step] },
    };
  } catch (error) {
    save = { state: 'failed', error: String(error) };
  }
  label = 'done';
  return { ...model, save, label, saved };
}

export function persist$1(model, [$outcome, props$step]) {
  let { todos, save, label, saved } = model;
  try {
    if (!$outcome.ok) {
      throw $outcome.error;
    }
    save = { state: 'idle' };
    saved = saved + props$step;
  } catch (error) {
    save = { state: 'failed', error: String(error) };
  }
  label = 'done';
  return { ...model, save, label, saved };
}
