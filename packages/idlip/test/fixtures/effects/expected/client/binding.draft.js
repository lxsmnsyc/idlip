function getText$(value) {
	if (value === null || value === undefined || typeof value === "boolean") {
		return "";
	};
	return String(value);
}

function joinClass$(value) {
	const names = [];
	for (const [name, enabled] of Object.entries(value)) {
		if (enabled) {
			names.push(name);
		}
	};
	return names.join(" ");
}

function setAttr$(el, name, value) {
	if (name === "value" || name === "checked" || name === "selected") {
		Reflect.set(el, name, name === "value" ? getText$(value) : Boolean(value));
		return;
	};
	if (value === false || value === null || value === undefined) {
		el.removeAttribute(name);
	} else if (typeof value === "object") {
		const names = joinClass$(value);
		if (names === "") {
			el.removeAttribute(name);
		} else {
			el.setAttribute(name, names);
		}
	} else {
		el.setAttribute(name, value === true ? "" : getText$(value));
	}
}

export function a0(el, { model }) {
setAttr$(el, 'value', model.draft);
}
