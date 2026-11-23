// The REPL loads only on its page: the import is a chunk of its own, which no other page asks for.
import { createMessagePanel } from './lib/network.ts';

const root = document.querySelector<HTMLElement>('[data-repl]');

if (root) {
  const target = root;
  import('../repl/app.ts').then(
    (module) => {
      module.startRepl(target, createMessagePanel);
    },
    (error: unknown) => {
      const status = target.querySelector('[data-repl-status]');
      if (status) {
        status.textContent = 'The REPL could not load. Reload the page.';
      }
      throw error;
    },
  );
}
