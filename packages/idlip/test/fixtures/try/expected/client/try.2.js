function getText$(value) {
	if (value === null || value === undefined || typeof value === "boolean") {
		return "";
	};
	return String(value);
}

function escapeText$(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getRows$(start, model, paths) {
	const levels = [];
	let node = start;
	while (node !== null) {
		let depth = 0;
		let row = false;
		let index = 0;
		let list;
		for (let item = node.previousSibling; item !== null && list === undefined; item = item.previousSibling) {
			const data = item.nodeType === 8 ? item.nodeValue ?? "" : "";
			if (data === "/i") {
				index += row && depth === 0 ? 1 : 0;
				depth++;
			} else if (data === "i") {
				row ||= depth === 0;
				depth -= depth === 0 ? 0 : 1;
			} else if (row && depth === 0 && /^l\d/.test(data)) {
				levels.push({
					id: data.slice(1),
					index
				});
				list = item;
			}
		};
		node = list ?? node.parentNode;
	};
	const rows = [];
	for (const { id, index } of levels.toReversed()) {
		let value = model;
		let star = 0;
		for (const key of paths[id].split(".")) {
			value = Reflect.get(Object(value), key === "*" ? rows[star++].index : key);
		};
		rows.push({
			item: Reflect.get(Object(value), index),
			index
		});
	};
	return rows;
}

function text$(value) {
	return escapeText$(getText$(value));
}

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function render(error) {
return `<button on:click='["$reset",[2]]'>${text$(error)}</button>`;
}

const lists$ = {"5":"items"};

export function region({ model }, start) {
const rows = getRows$(start, model, lists$);
let $try2;
try {
$try2 = `<!--e2:0--><span><!--t6-->${text$(check(rows[0].item.n))}<!--/t--></span><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try2 = `<!--e2:1--><button on:click='["$reset",[2]]'>${text$(error)}</button><!--/e-->`;
}
return $try2;
}
