// oxlint-disable import/prefer-default-export
/** The module `vite-plugin` writes next to the loader: the build id, and the check to run. */
interface BuildModule {
  readonly check: () => void;
}

// oxlint-disable-next-line typescript/promise-function-async
function importBuild(url: string): Promise<BuildModule> {
  // The import stays alone in its function, so the build keeps the comment.
  return import(/* @vite-ignore */ url);
}

/**
 * Called when a chunk failed to load for good. It imports `build.js` from the folder of the
 * loader, which reloads the page once per build and tab when the server runs another build.
 * The loader holds only this call: the check lives in `build.js`, and the build before this one
 * keeps its files, so the import still loads. The URL is the same each time, so a later failure
 * runs the check from the module the page already holds.
 */
export function checkSkew(): void {
  importBuild(import.meta.url.replace(/[^/]*$/, 'build.js')).then(
    (build) => {
      build.check();
    },
    () => {
      // The server has no build file: the error stays what it was.
    },
  );
}
