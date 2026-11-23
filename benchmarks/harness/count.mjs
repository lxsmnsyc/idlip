// The count of open todos. Every app renders it in the paragraph after the list, as "N left".
// Reading the whole page body can run the last title into the count ("Todo number 3" and
// "2 left" read as "32 left"), so the harness reads the element after the list only.

// Returns the count, or undefined when the element is missing or does not match. It runs in
// the page, so it uses nothing from outside.
export function readCount(doc) {
  const match = /^\s*(\d+)\s*left/.exec(doc.querySelector('ul + p')?.textContent ?? '');
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

// The argument the page functions get: the source of `readCount`.
export const COUNT_ARG = { source: readCount.toString() };
