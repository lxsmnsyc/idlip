// The one script of the site: the theme switch and the copy buttons of code blocks.
import './styles.css';

/** Whether the page shows the dark theme now, chosen or from the system. */
function isDark(): boolean {
  const root = document.documentElement;
  return (
    root.dataset.theme === 'dark' ||
    (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

/** Switches the theme and saves the choice. */
function switchTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', root.dataset.theme);
  } catch {
    // Storage can be blocked. The theme still changes for this page.
  }
}

/** Shows a label on the copy button for a moment, then restores it. */
function showLabel(button: HTMLButtonElement, label: string): void {
  button.textContent = label;
  setTimeout(() => {
    button.textContent = 'Copy';
  }, 1500);
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  if (event.target.closest('.theme-toggle')) {
    switchTheme();
    return;
  }
  const copy = event.target.closest<HTMLButtonElement>('.code-copy');
  const code = copy?.parentElement?.querySelector('pre');
  if (copy && code) {
    navigator.clipboard.writeText(code.textContent).then(
      () => {
        showLabel(copy, 'Copied');
      },
      () => {
        showLabel(copy, 'Failed');
      },
    );
  }
});
