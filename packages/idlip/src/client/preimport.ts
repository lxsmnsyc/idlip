// oxlint-disable import/prefer-default-export

/**
 * Imports the modules that the page's `<link rel="modulepreload">` tags name, once the page has
 * loaded and the browser is idle. A preload only fetches a module, and an `import()` of a module
 * still resolves in a task of its own, so without this the first click waits for that task and
 * for the module to run. `load` is the loader's memo, so the click awaits the same settled
 * promise.
 */
export function startPreimport(load: (url: string) => Promise<unknown>): void {
  function preimport(): void {
    for (const link of document.querySelectorAll('link[rel=modulepreload]')) {
      // A failed import is retried by the event that needs the module.
      load(link.getAttribute('href')!).catch(() => {});
    }
  }

  // After `load`, so the imports never run before the page has loaded. A loader script in the
  // page's markup runs before `load`, since the event waits for it. Safari has no
  // `requestIdleCallback`.
  addEventListener('load', () => {
    // The DOM types declare it everywhere.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    (self.requestIdleCallback ?? setTimeout)(preimport);
  });
}
