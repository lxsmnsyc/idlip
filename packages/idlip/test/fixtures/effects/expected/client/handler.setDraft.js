export function setDraft(model, [text]) {
  let { draft } = model;
  draft = text;
  return { ...model, draft };
}
