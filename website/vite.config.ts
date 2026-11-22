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
export default defineConfig({
  base,
  plugins: [demo()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    target: 'es2023',
    rolldownOptions: {
      input: 'src/client.ts',
      output: { entryFileNames: 'assets/site.js', assetFileNames: 'assets/site[extname]' },
    },
  },
});
