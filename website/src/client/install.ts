// The install tabs: pick a package manager, and the command and the copy button follow. The
// choice is the same on every tab group of the page and is kept for the next visit.

const KEY = 'package-manager';

function readSaved(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveChoice(manager: string): void {
  try {
    localStorage.setItem(KEY, manager);
  } catch {
    // Storage can be blocked. The choice still holds for this visit.
  }
}

/** Shows one manager in every tab group. A group without that manager stays as it is. */
function selectManager(manager: string): void {
  for (const group of document.querySelectorAll<HTMLElement>('[data-install]')) {
    const tabs = group.querySelectorAll<HTMLButtonElement>('.install-tab');
    let active: HTMLButtonElement | undefined;
    for (const tab of tabs) {
      if (tab.dataset.manager === manager) {
        active = tab;
      }
    }
    if (active === undefined) {
      continue;
    }
    const panel = group.querySelector('.install-command');
    for (const tab of tabs) {
      const on = tab === active;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (panel?.id) {
        tab.setAttribute('aria-controls', panel.id);
      }
    }
    const command = active.dataset.command ?? '';
    if (panel) {
      panel.textContent = command;
      panel.setAttribute('aria-labelledby', active.id);
    }
    const copy = group.querySelector<HTMLElement>('.code-copy');
    if (copy) {
      copy.dataset.copy = command;
    }
  }
}

/** The tab an arrow key, Home or End moves to, or `undefined` for any other key. */
function findTarget(
  tabs: readonly HTMLButtonElement[],
  current: number,
  key: string,
): HTMLButtonElement | undefined {
  if (key === 'ArrowRight') {
    return tabs[(current + 1) % tabs.length];
  }
  if (key === 'ArrowLeft') {
    return tabs[(current - 1 + tabs.length) % tabs.length];
  }
  if (key === 'Home') {
    return tabs[0];
  }
  if (key === 'End') {
    return tabs.at(-1);
  }
  return undefined;
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const tab = event.target.closest<HTMLButtonElement>('.install-tab');
  if (tab?.dataset.manager !== undefined) {
    selectManager(tab.dataset.manager);
    saveChoice(tab.dataset.manager);
  }
});

document.addEventListener('keydown', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const tab = event.target.closest<HTMLButtonElement>('.install-tab');
  const list = tab?.closest('[role="tablist"]');
  if (!tab || !list) {
    return;
  }
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('.install-tab')];
  const target = findTarget(tabs, tabs.indexOf(tab), event.key);
  if (target?.dataset.manager !== undefined) {
    event.preventDefault();
    selectManager(target.dataset.manager);
    saveChoice(target.dataset.manager);
    target.focus();
  }
});

const saved = readSaved();
if (saved !== undefined) {
  selectManager(saved);
}

// A module, so its declarations stay local to it.
export {};
