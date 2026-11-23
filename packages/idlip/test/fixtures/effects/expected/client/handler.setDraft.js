export function setDraft(model, [text]) {
  let { draft } = model;
  draft = text;
  return { ...model, draft };
}

export function $e0($e, $c) {
return [['setDraft', [$c.value]]];
}
