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
  // A button with `data-copy` carries its own text, such as the install command.
  const text = copy?.dataset.copy ?? copy?.parentElement?.querySelector('pre')?.textContent;
  if (copy && text !== undefined) {
    navigator.clipboard.writeText(text).then(
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
