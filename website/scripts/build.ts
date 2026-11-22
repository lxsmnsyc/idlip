// oxlint-disable no-console
// Builds the site: Vite bundles the script and the stylesheet into dist/client, then every page
// is rendered next to them.
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { writeSite } from '../src/site.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.env.BASE ?? '/';

await build({ root, logLevel: 'warn' });
const pages = await writeSite(fileURLToPath(new URL('../dist/client/', import.meta.url)), base);
console.log(`${pages.length} pages written to dist/client`);
