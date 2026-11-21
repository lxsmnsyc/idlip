import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts' })],
  environments: {
    client: {
      build: {
        // The adapter reads the manifest to find the built loader.
        manifest: true,
        rolldownOptions: {
          input: { loader: 'idlip/client' },
          output: {
            entryFileNames: 'assets/[name].[hash].js',
            chunkFileNames: 'assets/[name].[hash].js',
          },
        },
      },
    },
  },
});
