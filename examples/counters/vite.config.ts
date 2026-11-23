import { idlip } from 'idlip/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // `entry` is the ssr input, and its default export answers each request. Nitro serves it.
    idlip({ entry: '/src/entry-server.ts' }),
    // The loader asks for build.js to learn which build the server runs, so it must not be cached.
    nitro({ routeRules: { '/assets/build.js': { headers: { 'cache-control': 'no-store' } } } }),
  ],
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: { loader: 'idlip/client' },
          // A hash may hold `-`, so a `.` separates it from the chunk name. The e2e tests read
          // chunk names from these file names.
          output: {
            entryFileNames: 'assets/[name].[hash].js',
            chunkFileNames: 'assets/[name].[hash].js',
          },
        },
      },
    },
  },
});
