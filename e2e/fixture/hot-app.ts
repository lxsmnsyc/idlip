// Copies an example app to `e2e/.hot/<name>`, so the hot update tests edit a copy and the
// examples stay as they are. The copy links each package of the example's `node_modules`, and
// keeps its own `node_modules/.nitro`, since Nitro writes paths relative to its own folder.
// Usage: `node fixture/hot-app.ts <example> [fallback|styles|styles-fallback]`. With `fallback` the copy is `<example>-fallback`
// and its config has no `nitro()`, so the dev middleware of the plugin serves the pages. A copy of `counters-subs` also counts the starts of
// its subscription source in `window.idlipStarts`.
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const name = process.argv.at(2);
if (name === undefined) {
  throw new Error('Usage: node fixture/hot-app.ts <example>');
}
const source = path.resolve(import.meta.dirname, '../../examples', name);
// `fallback`, `styles` and `styles-fallback` make copies of their own, so a test that edits one
// copy never races a test that reads another.
const mode = process.argv.at(3) ?? '';
const fallback = mode.endsWith('fallback');
const target = path.resolve(import.meta.dirname, '../.hot', mode === '' ? name : `${name}-${mode}`);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const item of ['src', 'vite.config.ts', 'package.json', 'tsconfig.json']) {
  cpSync(path.join(source, item), path.join(target, item), { recursive: true });
}
mkdirSync(path.join(target, 'node_modules'));
for (const item of readdirSync(path.join(source, 'node_modules'))) {
  // Nitro and Vite keep a cache in `node_modules`, which the copy makes for itself.
  if (!['.nitro', '.vite', '.vite-temp'].includes(item)) {
    symlinkSync(
      path.join(source, 'node_modules', item),
      path.join(target, 'node_modules', item),
      'dir',
    );
  }
}

if (fallback) {
  // Drop the Nitro import and the plugin with its comment, so no plugin named `nitro:main` is left.
  const file = path.join(target, 'vite.config.ts');
  const lines = readFileSync(file, 'utf8').split('\n');
  const kept = lines.filter((line) => !/nitro|The loader asks/.test(line));
  writeFileSync(file, kept.join('\n'));
}

if (name === 'counters-subs') {
  const file = path.join(target, 'src/counter.tsx');
  const code = readFileSync(file, 'utf8');
  const head = 'async function* idle(_input: number, signal: AbortSignal) {\n';
  if (!code.includes(head)) {
    throw new Error(`${file} has no source to count`);
  }
  writeFileSync(
    file,
    code.replace(
      head,
      `${head}  Reflect.set(globalThis, 'idlipStarts', Number(Reflect.get(globalThis, 'idlipStarts') ?? 0) + 1);\n`,
    ),
  );
}
