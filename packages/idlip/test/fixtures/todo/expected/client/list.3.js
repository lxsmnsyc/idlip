function getText$(value) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  return String(value);
}

function escapeText$(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttr$(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function joinClass$(value) {
  const names = [];
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled) {
      names.push(name);
    }
  }
  return names.join(' ');
}

function text$(value) {
  return escapeText$(getText$(value));
}

function attr$(name, value) {
  if (value === false || value === null || value === undefined) {
    return '';
  }
  if (value === true) {
    return ` ${name}`;
  }
  if (name === 'class' && typeof value === 'object') {
    const names = joinClass$(value);
    return names === '' ? '' : ` ${name}="${escapeAttr$(names)}"`;
  }
  return ` ${name}="${escapeAttr$(getText$(value))}"`;
}

function on$(event, message) {
  const json = JSON.stringify(message).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
  return ` on:${event}='${json}'`;
}

export function render({ rows }) {
  const t = rows[0].item;
  return `<li${attr$('class', { done: t.done })} i-a="4"><input type="checkbox"${attr$('checked', t.done)}${on$('click', ['toggle', [t.id]])} i-a="5 7"><!--t6-->${text$(t.text)}<!--/t--></li>`;
}
