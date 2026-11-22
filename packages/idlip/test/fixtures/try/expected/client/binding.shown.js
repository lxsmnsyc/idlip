import { addBlock as addBlock$, findInnerBlocks as findInnerBlocks$, parseHtml as parseHtml$, removeBlock as removeBlock$ } from 'idlip/client';

function getText$(value) {
	if (value === null || value === undefined || typeof value === "boolean") {
		return "";
	};
	return String(value);
}

function escapeText$(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function findEnd$(start) {
	let depth = 0;
	for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
		if (node.nodeType !== 8) {
			continue;
		};
		if (node.nodeValue === "/c") {
			if (depth === 0) {
				return node;
			};
			depth--;
		} else if (/^c\d/.test(node.nodeValue ?? "")) {
			depth++;
		}
	};
	return null;
}

function text$(value) {
	return escapeText$(getText$(value));
}

function setBranch$(start, branch, render, ns) {
	const colon = start.data.indexOf(":");
	const end = findEnd$(start);
	const parent = start.parentNode;
	if (start.data.slice(colon + 1) === String(branch) || end === null || parent === null) {
		return;
	};
	for (const block of findInnerBlocks$(start, end)) {
		removeBlock$(block);
	};
	removeBlock$(start);
	while (start.nextSibling !== end) {
		start.nextSibling?.remove();
	};
	const html = render(branch);
	for (const node of typeof html === "string" ? parseHtml$(start.ownerDocument, html, ns) : [html]) {
		parent.insertBefore(node, end);
	};
	start.data = `${start.data.slice(0, colon + 1)}${branch}`;
	for (const block of findInnerBlocks$(start, end)) {
		addBlock$(block);
	};
	addBlock$(start);
}

function check(value) {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export function c2(start, { model }) {
setBranch$(start, model.shown ? 0 : 1, renderC2);
}

function renderC2(branch) {
if (branch === 0) {
let $try1;
try {
$try1 = `<!--e1:0--><b>${text$(check(3))}</b><!--/e-->`;
} catch ($e) {
const error = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);
$try1 = `<!--e1:1--><em>${text$(error)}</em><!--/e-->`;
}
return $try1;
}
return '<i>hidden</i>';
}
