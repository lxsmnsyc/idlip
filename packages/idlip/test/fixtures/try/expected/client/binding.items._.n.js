function getText$(value) {
	if (value === null || value === undefined || typeof value === "boolean") {
		return "";
	};
	return String(value);
}

function setText$(start, value) {
	const text = getText$(value);
	if (start.nodeType === 1) {
		if (start.textContent !== text) {
			start.textContent = text;
		};
		return;
	};
	const first = start.nextSibling;
	if (first?.nodeType === 3) {
		if (first.nodeValue !== text) {
			first.nodeValue = text;
		}
	} else if (text !== "") {
		start.parentNode?.insertBefore(start.ownerDocument.createTextNode(text), first);
	}
}

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function t6(start, { rows }) {
setText$(start, check(rows[0].item.n));
}

// Covers `items`.
export function l5({ model }) {
return model.items;
}
