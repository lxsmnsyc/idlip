// The theme switch: follows the system until used, then saves the choice.

/** Whether the page shows the dark theme now, chosen or from the system. */
function isDark(): boolean {
  const root = document.documentElement;
  return (
    root.dataset.theme === 'dark' ||
    (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

function switchTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', root.dataset.theme);
  } catch {
    // Storage can be blocked. The theme still changes for this page.
  }
}

document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('.theme-toggle')) {
    switchTheme();
  }
});

// A module, so its declarations stay local to it.
export {};
