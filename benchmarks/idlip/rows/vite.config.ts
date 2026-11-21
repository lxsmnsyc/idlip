import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';

// Built with `vite build rows`, so the root is this folder.
export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts', client: '/src/loader.ts' })],
  environments: {
    client: {
      build: {
        // The adapter reads the manifest to find the built loader.
        manifest: true,
        rolldownOptions: {
          input: { loader: '/src/loader.ts' },
          output: {
            entryFileNames: 'assets/[name].[hash].js',
            chunkFileNames: 'assets/[name].[hash].js',
          },
        },
      },
    },
  },
});
