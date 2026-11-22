// The search bar in the header. This file only opens the command bar: the bar itself and its
// index load the first time it opens, so a page that never searches does not fetch them.

import type * as PaletteModule from '../search/palette.ts';

const TRIGGER = '.search-trigger';

let palette: Promise<typeof PaletteModule> | undefined;

function openPalette(): void {
  palette ??= import('../search/palette.ts');
  palette
    .then((module) => {
      module.openPalette();
    })
    .catch(reportError);
}

function isOpen(): boolean {
  return document.querySelector('dialog.command[open]') !== null;
}

/** Whether the focus is in something that takes typed text, so `/` is a character there. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

/** The platform of the system: the client hints where there are any, else the user agent. */
function readPlatform(): string {
  // `userAgentData` is not in every browser or in the DOM types of every TypeScript version.
  const hints: unknown = Reflect.get(navigator, 'userAgentData');
  const platform: unknown =
    typeof hints === 'object' && hints !== null ? Reflect.get(hints, 'platform') : '';
  return typeof platform === 'string' && platform !== '' ? platform : navigator.userAgent;
}

// The key hint names the key of the system.
if (/Mac|iPhone|iPad/.test(readPlatform())) {
  for (const key of document.querySelectorAll(`${TRIGGER} kbd`)) {
    key.textContent = '⌘K';
  }
}

document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest(TRIGGER)) {
    openPalette();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented) {
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (isOpen()) {
      palette
        ?.then((module) => {
          module.closePalette();
        })
        .catch(reportError);
    } else {
      openPalette();
    }
  } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (!isTyping(event.target) && !isOpen()) {
      event.preventDefault();
      openPalette();
    }
  }
});
