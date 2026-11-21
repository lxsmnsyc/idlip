// oxlint-disable import/prefer-default-export
// Adds and removes the head elements of `<Head>` blocks, and keeps `document.title` on the last
// title. A block is `<!--c<id>:h--><template i-head="<n>" i-a="<ids>"></template><!--/c-->`. The
// elements of a block in `<head>` carry `i-head="<n>.<index>"`. The server writes them. A block
// that a patch adds holds its elements in the template, and the hook moves them to `<head>`.
// `contracts/compiled-format-head.change-request.md` describes the markers.
import { onBlock } from './patch/blocks.ts';

let hooked = false;
let patched = 0;

function isHead(start: Comment): boolean {
  return start.data.endsWith(':h');
}

function getMarker(start: Comment): Element {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return start.nextSibling as Element;
}

function addHead(start: Comment): void {
  if (!isHead(start)) {
    return;
  }
  const marker = getMarker(start);
  // A number from the server is plain digits, so a `p` keeps the two apart.
  const id = `p${patched++}`;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const { content } = marker as HTMLTemplateElement;
  for (const [index, element] of [...content.children].entries()) {
    element.setAttribute('i-head', `${id}.${index}`);
    document.head.append(element);
  }
  marker.setAttribute('i-head', id);
}

function removeHead(start: Comment): void {
  if (isHead(start)) {
    const id = getMarker(start).getAttribute('i-head');
    for (const element of document.head.querySelectorAll(`[i-head^="${id}."]`)) {
      element.remove();
    }
  }
}

/**
 * Puts the last title of the page first in `<head>`, where `document.title` reads it. The page
 * order is the order of the markers in the body, so no block needs a state of its own.
 */
function syncTitle(): void {
  let last: Element | null = null;
  for (const marker of document.querySelectorAll('template[i-head]')) {
    const title = document.head.querySelector(`title[i-head^="${marker.getAttribute('i-head')}."]`);
    last = title ?? last;
  }
  if (last !== null && last !== document.head.querySelector('title')) {
    document.head.prepend(last);
  }
}

/**
 * Registers the block hooks and watches `<head>`, so a title change that a binding makes
 * reaches `document.title`. Returns the function that stops the watch.
 */
export function startHead(): () => void {
  if (!hooked) {
    hooked = true;
    onBlock(addHead, removeHead);
  }
  const observer = new MutationObserver(syncTitle);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  syncTitle();
  return () => {
    observer.disconnect();
  };
}
