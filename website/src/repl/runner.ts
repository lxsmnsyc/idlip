// A runner compiles the files of one editor, asks the worker to render them, and stores the run
// for its frame. Each runner keeps its own run folder, so two live samples on one page keep each
// other's chunks. `run.ts` gives it the browser services, and the tests give it fakes.
import { listChunks, writeFrameShim } from './chunks.ts';
import type { ServedChunk } from './chunks.ts';
import type { ReplFile } from './files.ts';
import { writeFrameDocument } from './frame-document.ts';
import { compileProject } from './project.ts';
import type { Project } from './project.ts';
import type { Rendered } from './render.ts';
import type { Ask } from './requests.ts';

/** A render that takes longer is stopped with its worker. */
export const RENDER_LIMIT = 5000;

export type RunResult =
  /** Compiled only: the reader has not chosen to run it, or a file has an error. */
  | { kind: 'compiled'; project: Project }
  | { kind: 'served'; project: Project; url: string; chunks: ServedChunk[]; rendered: Rendered }
  /** Compiled, but the render or the service worker failed. */
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
  /** Starts the service worker once and gives the URL of the folder it serves. */
  serve: () => Promise<string>;
  ask: Ask;
  /** Puts a run in the cache. Drops the older runs under `own`. */
  store: (
    own: string,
    folder: string,
    document: string,
    chunks: readonly ServedChunk[],
  ) => Promise<void>;
  /** The URL of the loader module of the frame. */
  runtime: () => string;
  createId: () => string;
  /** Makes a module URL for code, and revokes one. */
  createUrl: (code: string) => string;
  revokeUrl: (url: string) => void;
}

/** Counts the requests to the worker, across every runner of the page. */
let requests = 0;

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createRunner(services: RunnerServices): Runner {
  const owner = services.createId();
  let runs = 0;
  let shim: string | undefined;

  return async (files, styles, render) => {
    const project = compileProject(files);
    if (!render || !project.ok) {
      return { kind: 'compiled', project };
    }
    try {
      const own = `${await services.serve()}${owner}/`;
      const run = ++runs;
      const folder = `${own}${run}/`;

      // The chunks read the loader through a module URL, which the network panel does not list:
      // an app build has no such file. The run before this one is gone with its frame.
      if (shim !== undefined) {
        services.revokeUrl(shim);
      }
      shim = services.createUrl(writeFrameShim(project));
      const chunks = listChunks(project, folder, shim);

      const answer = await services.ask({ id: ++requests, project, chunks, folder }, RENDER_LIMIT);
      if (answer.kind === 'failed') {
        return { kind: 'failed', project, message: `The server render failed: ${answer.message}` };
      }
      const document = writeFrameDocument({
        rendered: answer.rendered,
        styles,
        runtime: services.runtime(),
        run,
      });
      await services.store(own, folder, document, chunks);
      return { kind: 'served', project, url: folder, chunks, rendered: answer.rendered };
    } catch (error) {
      return { kind: 'failed', project, message: getMessage(error) };
    }
  };
}
