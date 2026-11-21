function setOn$(el, event, message) {
  el.setAttribute(`on:${event}`, JSON.stringify(message));
}

export function a2(el, { props }) {
  setOn$(el, 'click', props.onRemove);
}
