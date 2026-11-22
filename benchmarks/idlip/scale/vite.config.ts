import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';

// Built with `vite build scale`, so the root is this folder.
export default defineConfig({
  plugins: [
    idlip({
      entry: '/src/entry-server.ts',
      // `IDLIP_PREIMPORT=0` builds the loader without the idle import, for an A/B.
      preimport: process.env.IDLIP_PREIMPORT !== '0',
    }),
  ],
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
