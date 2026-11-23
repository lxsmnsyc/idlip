// Copies an example app to `e2e/.hot/<name>`, so the hot update tests edit a copy and the
// examples stay as they are. The copy shares the example's `node_modules`.
// Usage: `node fixture/hot-app.ts <example>`. A copy of `counters-subs` also counts the starts of
// its subscription source in `window.idlipStarts`.
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const name = process.argv.at(2);
if (name === undefined) {
  throw new Error('Usage: node fixture/hot-app.ts <example>');
}
const source = path.resolve(import.meta.dirname, '../../examples', name);
const target = path.resolve(import.meta.dirname, '../.hot', name);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const item of ['src', 'vite.config.ts', 'package.json', 'tsconfig.json']) {
  cpSync(path.join(source, item), path.join(target, item), { recursive: true });
}
symlinkSync(path.join(source, 'node_modules'), path.join(target, 'node_modules'), 'dir');

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
