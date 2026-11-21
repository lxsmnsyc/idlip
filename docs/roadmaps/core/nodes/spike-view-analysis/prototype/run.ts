// Analyzes every fixture, writes out/<name>.txt and prints counts and timings.
// Run: node run.ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, printModule } from './analyze.ts';

const here = import.meta.dirname;
const fixtures = join(here, 'fixtures');
const out = join(here, 'out');
mkdirSync(out, { recursive: true });

// Warm up the parser so the first file's timing is not the module load.
analyze('warmup.tsx', readFileSync(join(fixtures, 'todo.idlip.tsx'), 'utf8'));

for (const name of readdirSync(fixtures).sort()) {
  const source = readFileSync(join(fixtures, name), 'utf8');
  const runs: number[] = [];
  let ir = analyze(name, source);
  for (let run = 0; run < 20; run++) {
    const started = performance.now();
    ir = analyze(name, source);
    runs.push(performance.now() - started);
  }
  runs.sort((a, b) => a - b);
  writeFileSync(
    join(out, name.replace(/\.idlip\.tsx(\.txt)?$/, '.txt')),
    `${printModule(ir, source)}\n`,
  );
  // The contract stub: the full IR of the counter and todo views.
  if (name === 'counter.idlip.tsx' || name === 'todo.idlip.tsx') {
    writeFileSync(
      join(out, name.replace('.idlip.tsx', '.json')),
      `${JSON.stringify(ir, null, 2)}\n`,
    );
  }
  let holes = 0;
  let dynamic = 0;
  for (const component of ir.components) {
    holes += component.holes.length;
    for (const hole of component.holes) if (hole.paths === 'dynamic') dynamic++;
  }
  let errors = 0;
  let warnings = 0;
  for (const diagnostic of ir.diagnostics) {
    if (diagnostic.severity === 'error') errors++;
    else warnings++;
  }
  const median = runs[Math.floor(runs.length / 2)]!;
  console.log(
    `${name.padEnd(24)} ${String(source.length).padStart(5)} B  components ${ir.components.length}  holes ${String(holes).padStart(2)}  dynamic ${dynamic}  errors ${String(errors).padStart(2)}  warnings ${warnings}  median ${median.toFixed(2)} ms`,
  );
}

// Format the JSON output with the repo's formatter, so `pnpm format:check` passes.
const root = join(here, '..', '..', '..', '..', '..', '..');
const oxfmt = join(root, 'node_modules', '.bin', 'oxfmt');
if (existsSync(oxfmt)) {
  execFileSync(oxfmt, [out], { cwd: root, stdio: 'ignore' });
} else {
  console.error(
    `oxfmt not found at ${oxfmt}: run pnpm install at the repo root, then run this again`,
  );
}
