export function setDraft(model, [text]) {
  let { draft } = model;
  draft = text;
  return { ...model, draft };
}

export function $e1($e, $c) {
return [['setDraft', [$c.value]]];
}
