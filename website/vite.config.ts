import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { buildDemo } from './src/demo/build.ts';

const base = process.env.BASE ?? '/';
const outDir = fileURLToPath(new URL('dist/client', import.meta.url));

/** Builds the landing demo, `examples/todo`, into `dist/client/demo/` after the site bundle. */
function demo(): Plugin {
  return {
    name: 'website:demo',
    apply: 'build',
    async closeBundle() {
      await buildDemo(outDir, base);
    },
  };
}

// Vite bundles the one script and the one stylesheet of the site. `scripts/build.ts` renders the
// pages around them, so the files keep fixed names.
const require = createRequire(import.meta.url);

export default defineConfig({
  base,
  plugins: [demo()],
  resolve: {
    alias: {
      // The REPL compiles in the browser. The browser build of oxc-parser imports its
      // WebAssembly binding by this name.
      '@oxc-parser/binding-wasm32-wasip1': path.join(
        path.dirname(require.resolve('@oxc-parser/binding-wasm32-wasi/package.json')),
        'parser.wasi-browser.js',
      ),
    },
  },
  // The WebAssembly binding loads its own files, so the dev server leaves it as it is.
  optimizeDeps: { exclude: ['oxc-parser', '@oxc-parser/binding-wasm32-wasi'] },
  // The REPL's render worker, runtime and service worker are module workers.
  worker: { format: 'es' },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    target: 'es2023',
    // The REPL chunk is loaded by a plain `import()`, so no other page gets a preload helper.
    modulePreload: false,
    // The REPL's run chunk holds the compiler.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      input: 'src/client.ts',
      output: {
        entryFileNames: 'assets/site.js',
        assetFileNames: 'assets/site[extname]',
        // The idlip compiler in the REPL copies its helpers into chunks by their source text and
        // checks their names, so function names stay. Other names still shrink.
        minify: {
          compress: { keepNames: { function: true, class: false } },
          mangle: { keepNames: { function: true, class: false } },
        },
      },
    },
  },
});
