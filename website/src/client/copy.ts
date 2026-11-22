// The copy buttons of code blocks.

/** The polite live region that says the result of a copy to screen readers. */
function findStatus(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('[data-copy-status]');
  if (existing) {
    return existing;
  }
  const status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.dataset.copyStatus = '';
  document.body.append(status);
  return status;
}

/**
 * Shows a label on the copy button for a moment, then restores it. The accessible name follows
 * the visible text meanwhile, and the live region says the result.
 */
function showLabel(button: HTMLButtonElement, label: string, done: boolean): void {
  const original = button.dataset.label ?? button.getAttribute('aria-label') ?? '';
  button.dataset.label = original;
  button.textContent = label;
  button.classList.toggle('is-done', done);
  if (original !== '') {
    button.setAttribute('aria-label', label);
  }
  findStatus().textContent = done ? 'Copied' : 'Failed to copy';
  setTimeout(() => {
    button.textContent = 'Copy';
    button.classList.remove('is-done');
    if (original !== '') {
      button.setAttribute('aria-label', original);
    }
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
