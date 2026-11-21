import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/server/index.ts',
    'src/client/index.ts',
    'src/compiler/index.ts',
    'src/vite/index.ts',
    'src/jsx-runtime/index.ts',
  ],
  format: 'esm',
  platform: 'neutral',
  target: 'node22',
  dts: true,
  sourcemap: true,
  fixedExtension: false,
  deps: { neverBundle: ['vite', 'oxc-parser', 'seroval', /^node:/] },
});
