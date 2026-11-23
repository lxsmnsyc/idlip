// The messages between the REPL page and the REPL worker. Each request carries an id, and the
// answer carries the same id.
import type { ServedChunk } from './chunks.ts';
import type { Project } from './project.ts';
import type { Rendered } from './render.ts';

/** Renders the compiled project, with its chunks at `folder`. */
export interface ToWorker {
  id: number;
  project: Project;
  chunks: ServedChunk[];
  folder: string;
}

export type FromWorker =
  | { kind: 'rendered'; id: number; rendered: Rendered }
  | { kind: 'failed'; id: number; message: string }
  /** A module URL the worker made for the request. The page revokes it if it ends the worker. */
  | { kind: 'blob'; id: number; url: string };
