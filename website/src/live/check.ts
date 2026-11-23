// Checks the live samples of the docs in Node. The site build compiles them and fails on an
// error. `check:samples` also renders each one on the server side, as the site build does.
import { listChunks } from '../repl/chunks.ts';
import type { ReplFile } from '../repl/files.ts';
import { compileProject } from '../repl/project.ts';
import { createDataUrl, renderProject } from '../repl/render.ts';

/** A live sample and the page it is on. */
export interface PageSample {
  /** The Markdown file, such as `docs/views.md`. */
  file: string;
  /** The page and the place of the sample on it, such as `views-3`. */
  id: string;
  files: ReplFile[];
}

/** Where the chunks of a checked render point. Nothing loads them. */
const FOLDER = 'https://live.test/run/';

/** Compiles every sample and lists its errors, one line each. */
export function checkLiveSamples(samples: readonly PageSample[]): string[] {
  const problems: string[] = [];
  for (const sample of samples) {
    for (const problem of compileProject(sample.files).problems) {
      if (problem.severity === 'error') {
        problems.push(
          `${sample.file}: ${problem.file}:${problem.line}:${problem.column}: ${problem.rule}: ${problem.message}`,
        );
      }
    }
  }
  return problems;
}

/** Renders every sample that compiles, and lists the renders that throw. */
export async function renderLiveSamples(samples: readonly PageSample[]): Promise<string[]> {
  const problems: string[] = [];
  for (const sample of samples) {
    const project = compileProject(sample.files);
    if (!project.ok) {
      continue;
    }
    try {
      await renderProject(project, listChunks(project, FOLDER, FOLDER), FOLDER, createDataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push(`${sample.file}: ${sample.files[0].name}: the render failed: ${message}`);
    }
  }
  return problems;
}
