import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    brumate({
      navigate: false,
      exclude: (dir) => dir === 'node_modules' || dir === 'dist' || dir.startsWith('.'),
    }),
  ],
  build: {
    // The adapter reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: { input: 'src/client.ts' },
  },
});
