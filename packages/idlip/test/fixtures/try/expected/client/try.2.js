function getText$(value) {
	if (value === null || value === undefined || typeof value === "boolean") {
		return "";
	};
	return String(value);
}

function escapeText$(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function text$(value) {
	return escapeText$(getText$(value));
}

export function render(error) {
return `<button on:click='["$reset",[2]]'>${text$(error)}</button>`;
}
