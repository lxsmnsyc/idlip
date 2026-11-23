import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Connect, Plugin } from 'vite';
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

/**
 * Lets a frame without an origin read the fonts. The REPL frame and the frame of an edited live
 * sample are sandboxed, so their origin is `null` and a font request is cross-origin. Vite's own
 * CORS setting allows localhost origins only. `vercel.json` sends the same header in production.
 */
function fontCors(): Plugin {
  const allow: Connect.NextHandleFunction = (request, response, next) => {
    if (request.url?.startsWith(`${base}fonts/`)) {
      response.setHeader('Access-Control-Allow-Origin', '*');
    }
    next();
  };
  return {
    name: 'website:font-cors',
    configureServer(server) {
      server.middlewares.use(allow);
    },
    configurePreviewServer(server) {
      server.middlewares.use(allow);
    },
  };
}

// Vite bundles the one script and the one stylesheet of the site. `scripts/build.ts` renders the
// pages around them, so the files keep fixed names.
const require = createRequire(import.meta.url);

export default defineConfig({
  base,
  plugins: [demo(), fontCors()],
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
  // The REPL's render worker and runtime are module workers.
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
      },
    },
  },
});
