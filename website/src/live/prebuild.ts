// Writes the static frame of each live sample at build time. A reader who never edits a sample
// sees this frame: the server render as a page, its client chunks and the shared loader. No
// compiler, no worker load for it. Events still resume in it.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { listChunks, writeFrameShim } from '../repl/chunks.ts';
import { writeFrameDocument } from '../repl/frame-document.ts';
import { highlight } from '../repl/highlight.ts';
import { compileProject } from '../repl/project.ts';
import { createDataUrl, renderProject } from '../repl/render.ts';
import type { PageSample } from './check.ts';
import { listCompiledModules, renderCompiled } from './compiled.ts';
import type { CompiledRow } from './compiled.ts';

/** The folder of the live sample frames, under the site's base. */
export const LIVE_FOLDER = 'live/';

/** The module the chunks of a static frame import `idlip` and `idlip/client` from. */
const SHIM_FILE = 'idlip.js';

/** The tab content of the Compiled tab, which the page fetches when the tab first opens. */
export const COMPILED_FILE = 'compiled.html';

/** The address of the static frame of a sample. */
export function getFrameUrl(base: string, id: string): string {
  return `${base}${LIVE_FOLDER}${id}/`;
}

export interface PrebuildOptions {
  /** The built site folder. */
  outDir: string;
  base: string;
  /** The URL of the loader module of the frames. */
  runtime: string;
}

/** Writes `live/<id>/` for each sample: `index.html`, the chunks, their shim and the Compiled tab. */
export async function prebuildLiveSamples(
  samples: readonly PageSample[],
  options: PrebuildOptions,
): Promise<void> {
  const styles = `<link rel="stylesheet" href="${options.base}${LIVE_FOLDER}frame.css">`;
  for (const sample of samples) {
    const project = compileProject(sample.files);
    if (!project.ok) {
      throw new Error(`${sample.file}: the live sample ${sample.id} does not compile`);
    }
    const folder = getFrameUrl(options.base, sample.id);
    const target = path.join(options.outDir, LIVE_FOLDER, sample.id);
    mkdirSync(target, { recursive: true });

    // The chunks import the loader through the shim, as in a run of the REPL.
    const chunks = listChunks(project, folder, `${folder}${SHIM_FILE}`);
    for (const chunk of chunks) {
      writeFileSync(path.join(target, chunk.path), chunk.code);
    }
    writeFileSync(path.join(target, SHIM_FILE), writeFrameShim(project));

    // The server render, in Node, with the state naming the chunks by their URLs.
    let rendered;
    try {
      rendered = await renderProject(project, chunks, folder, createDataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${sample.file}: the live sample ${sample.id} did not render: ${message}`, {
        cause: error,
      });
    }
    writeFileSync(
      path.join(target, 'index.html'),
      writeFrameDocument({ rendered, styles, runtime: options.runtime, run: 0 }),
    );

    // The Compiled tab, with sizes as a server would send each module.
    const rows: CompiledRow[] = [];
    for (const module of listCompiledModules(project, chunks)) {
      rows.push({
        title: module.title,
        note: module.note,
        size: gzipSync(module.code).byteLength,
        html: highlight(module.code, 'ts'),
      });
    }
    writeFileSync(path.join(target, COMPILED_FILE), renderCompiled(rows));
  }
}
