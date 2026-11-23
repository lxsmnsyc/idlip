// The figures of the docs load their player when the first one nears the viewport. A page with
// no figure loads none of it.
import type * as PlayerModule from '../figures/player.ts';

/** How far below the viewport a figure starts to load, so it is ready when it scrolls in. */
const AHEAD = '400px 0px';

const roots = document.querySelectorAll<HTMLElement>('[data-figure][data-story]');

if (roots.length > 0) {
  let loading: Promise<typeof PlayerModule> | undefined;

  // A figure whose player fails to load keeps the last step the server wrote. The next figure
  // tries the import again.
  function start(root: HTMLElement): void {
    loading ??= import('../figures/player.ts');
    loading.then(
      (module) => {
        module.startFigure(root);
      },
      () => {
        loading = undefined;
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
