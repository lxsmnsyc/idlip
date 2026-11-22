import { attr$, on$, text$ } from 'idlip/helpers';

export function render({ rows }) {
  const t = rows[0].item;
  return `<li${attr$('class', { done: t.done })} i-a="4"><input type="checkbox"${attr$('checked', t.done)}${on$('click', ['toggle', [t.id]])} i-a="5 7"><!--t6-->${text$(t.text)}<!--/t--></li>`;
}
