// oxlint-disable no-console
// Compiles every fenced `tsx` block of the docs, so a sample that stops compiling fails the check.
// Live samples also compile as one project with their other files, and render on the server side.
import { readFileSync, readdirSync } from 'node:fs';
import { checkLiveSamples, renderLiveSamples } from '../src/live/check.ts';
import type { PageSample } from '../src/live/check.ts';
import { checkMarkdown, extractSamples } from '../src/samples.ts';
import { loadPages } from '../src/site.ts';

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

const live: PageSample[] = [];
loadPages(undefined, '/', new Map(), live);
for (const problem of [...checkLiveSamples(live), ...(await renderLiveSamples(live))]) {
  failures++;
  console.error(problem);
}

console.log(`${samples} samples, ${live.length} live, ${failures} problems`);
process.exitCode = failures > 0 ? 1 : 0;
