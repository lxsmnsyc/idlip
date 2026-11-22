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

export function a3(start, { model }) {
setText$(start, model.save.state);
}
