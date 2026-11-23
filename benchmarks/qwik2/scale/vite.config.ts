import { qwikVite } from '@qwik.dev/core/optimizer';
import { defineConfig } from 'vite';

// Built inside this folder, so the root is this folder.
export default defineConfig({
  plugins: [
    qwikVite({
      client: { outDir: 'dist/client' },
      ssr: { outDir: 'dist/server' },
    }),
  ],
});
