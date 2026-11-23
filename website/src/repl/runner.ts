// A runner compiles the files of one editor, asks the worker to render them, and writes the
// document of the sandboxed frame that runs them. The document holds the run's chunks, so the run
// needs no server and no storage, and the frame needs no origin. Each runner has its own run
// folder, which names the chunks of its frame. `run.ts` gives it the browser services, and the
// tests give it fakes.
import { listChunks, writeFrameShim } from './chunks.ts';
import type { ServedChunk } from './chunks.ts';
import type { ReplFile } from './files.ts';
import { writeSandboxDocument } from './frame-document.ts';
import type { FrameModule } from './frame-document.ts';
import { compileProject } from './project.ts';
import type { Project } from './project.ts';
import type { Rendered } from './render.ts';
import type { Ask } from './requests.ts';

/** A render that takes longer is stopped with its worker. */
export const RENDER_LIMIT = 5000;

export type RunResult =
  /** Compiled only: the reader has not chosen to run it, or a file has an error. */
  | { kind: 'compiled'; project: Project }
  | {
      kind: 'served';
      project: Project;
      /** The `srcdoc` of the sandboxed frame. */
      document: string;
      /** The name of the run folder, which the chunk URLs of the frame start with. */
      url: string;
      chunks: ServedChunk[];
      rendered: Rendered;
    }
  /** Compiled, but the render failed. */
  | { kind: 'failed'; project: Project; message: string };

/**
 * Runs the files of one editor. `styles` is the markup that styles the frame. Without `render`,
 * or when a file has an error, the files only compile.
 */
export type Runner = (
  files: readonly ReplFile[],
  styles: string,
  render: boolean,
) => Promise<RunResult>;

export interface RunnerServices {
  /** The URL of the folder that names the chunks of every run of the page. */
  base: () => string;
  /** The origin of the page, the only one the frame sends messages to. */
  origin: () => string;
  ask: Ask;
  /** The code of the loader module of the frame. */
  loadRuntime: () => Promise<string>;
  createId: () => string;
}

/** The file name of the module that gives the chunks the loader of the frame. */
const SHIM_PATH = 'idlip-frame.js';

/** Counts the requests to the worker, across every runner of the page. */
let requests = 0;

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createRunner(services: RunnerServices): Runner {
  const owner = services.createId();
  let runs = 0;

  return async (files, styles, render) => {
    const project = compileProject(files);
    if (!render || !project.ok) {
      return { kind: 'compiled', project };
    }
    try {
      const run = ++runs;
      const folder = `${services.base()}${owner}/${run}/`;
      const chunks = listChunks(project, folder, `${folder}${SHIM_PATH}`);

      const answer = await services.ask({ id: ++requests, project, chunks, folder }, RENDER_LIMIT);
      if (answer.kind === 'failed') {
        return { kind: 'failed', project, message: `The server render failed: ${answer.message}` };
      }

      // The chunks read the loader through the shim, and import each other by their URLs.
      const modules: FrameModule[] = [
        { url: `${folder}${SHIM_PATH}`, name: '', code: writeFrameShim(project) },
      ];
      for (const chunk of chunks) {
        modules.push({ url: `${folder}${chunk.path}`, name: chunk.path, code: chunk.code });
      }
      const document = writeSandboxDocument({
        rendered: answer.rendered,
        styles,
        runtime: await services.loadRuntime(),
        modules,
        run,
        origin: services.origin(),
      });
      return { kind: 'served', project, document, url: folder, chunks, rendered: answer.rendered };
    } catch (error) {
      return { kind: 'failed', project, message: getMessage(error) };
    }
  };
}
