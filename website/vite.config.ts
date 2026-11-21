import { defineConfig } from 'vite';

// Vite bundles the one script and the one stylesheet of the site. `scripts/build.ts` renders the
// pages around them, so the files keep fixed names.
export default defineConfig({
  base: process.env.BASE ?? '/',
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
