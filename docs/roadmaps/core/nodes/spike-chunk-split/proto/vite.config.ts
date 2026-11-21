/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
import path from 'node:path';
import { defineConfig } from 'vite';
import { idlip } from './plugin.ts';

const helpers = process.env.IDLIP_HELPERS === 'import' ? 'import' : 'inline';
const chunkOptimization = process.env.IDLIP_CHUNK_OPT !== 'off';
/** Copies common chunks under this size into each chunk that imports them. */
const inlineCommon = Number(process.env.IDLIP_INLINE_COMMON ?? 0);

export default defineConfig({
  plugins: [idlip({ helpers })],
  resolve: {
    alias: { idlip: path.resolve(import.meta.dirname, 'src/runtime.ts') },
  },
  logLevel: 'info',
  build: { minify: false },
  environments: {
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true,
        rolldownOptions: {
          input: 'src/entry-client.ts',
          experimental: { chunkOptimization },
          ...(inlineCommon > 0
            ? {
                preserveEntrySignatures: false,
                output: {
                  codeSplitting: { experimentalInlineCommonChunks: { maxSize: inlineCommon } },
                },
              }
            : {}),
        },
      },
    },
    ssr: {
      build: {
        outDir: 'dist/server',
        rolldownOptions: { input: 'src/entry-server.ts' },
      },
    },
  },
  builder: {
    async buildApp(builder) {
      // The server build reads the chunk manifest of the client build.
      await builder.build(builder.environments.client!);
      await builder.build(builder.environments.ssr!);
    },
  },
});
