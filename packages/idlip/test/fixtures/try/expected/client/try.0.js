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

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function render(error) {
return `<p>Failed: ${text$(error)} <button on:click='["$reset",[0]]'>Retry</button></p>`;
}

export function region() {
let $try0;
try {
$try0 = `<!--e0:0--><span>${text$(check(-1))}</span><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try0 = `<!--e0:1--><p>Failed: ${text$(error)} <button on:click='["$reset",[0]]'>Retry</button></p><!--/e-->`;
}
return $try0;
}
