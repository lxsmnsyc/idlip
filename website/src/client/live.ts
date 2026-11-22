// Live samples load when the first one nears the viewport: the editor chunk, then the compiler.
// A page with no live sample loads none of it.
import type * as SampleModule from '../live/sample.ts';

/** How far below the viewport a sample starts to load, so it is ready when it scrolls in. */
const AHEAD = '400px 0px';

const roots = document.querySelectorAll<HTMLElement>('[data-live-sample]');

function showFailure(root: HTMLElement, error: unknown): void {
  const status = root.querySelector('[data-live-status]');
  if (status) {
    status.textContent = 'Could not load. Reload the page.';
  }
  root.dataset.status = 'failed';
  throw error;
}

if (roots.length > 0) {
  let loading: Promise<typeof SampleModule> | undefined;

  function start(root: HTMLElement): void {
    loading ??= import('../live/sample.ts');
    loading.then(
      (module) => {
        module.startSample(root);
      },
      (error: unknown) => {
        showFailure(root, error);
      },
    );
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          observer.unobserve(entry.target);
          start(entry.target);
        }
      }
    },
    { rootMargin: AHEAD },
  );
  for (const root of roots) {
    observer.observe(root);
  }
}
