// oxlint-disable no-console
// Compiles every fenced `tsx` block of the docs, so a sample that stops compiling fails the check.
import { readFileSync, readdirSync } from 'node:fs';
import { checkMarkdown, extractSamples } from '../src/samples.ts';

const docs = new URL('../docs/', import.meta.url);
let samples = 0;
let failures = 0;

for (const entry of readdirSync(docs, { recursive: true, encoding: 'utf8' }).toSorted()) {
  if (!entry.endsWith('.md')) {
    continue;
  }
  const markdown = readFileSync(new URL(entry, docs), 'utf8');
  samples += extractSamples(markdown).length;
  for (const problem of checkMarkdown(markdown, entry)) {
    failures++;
    console.error(`${problem.file}:${problem.line}: ${problem.message}`);
  }
}

console.log(`${samples} samples, ${failures} problems`);
process.exitCode = failures > 0 ? 1 : 0;
