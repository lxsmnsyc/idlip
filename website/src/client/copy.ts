// The copy buttons of code blocks.

/** Shows a label on the copy button for a moment, then restores it. */
function showLabel(button: HTMLButtonElement, label: string, done: boolean): void {
  button.textContent = label;
  button.classList.toggle('is-done', done);
  setTimeout(() => {
    button.textContent = 'Copy';
    button.classList.remove('is-done');
  }, 1500);
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const copy = event.target.closest<HTMLButtonElement>('.code-copy');
  const code = copy?.parentElement?.querySelector('pre');
  if (copy && code) {
    navigator.clipboard.writeText(code.textContent).then(
      () => {
        showLabel(copy, 'Copied', true);
      },
      () => {
        showLabel(copy, 'Failed', false);
      },
    );
  }
});

// A module, so its declarations stay local to it.
export {};
