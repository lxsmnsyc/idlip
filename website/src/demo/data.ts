import { fileURLToPath } from 'node:url';

/** The file the landing page reads, written next to the server build of the demo. */
export const DEMO_DATA = fileURLToPath(
  new URL('../../dist/demo-server/demo.json', import.meta.url),
);

/** A file of the demo build, with its size as served and with gzip -9. */
export interface DemoFile {
  /** The path under the base, such as `demo/assets/loader.BMTA43Fn.js`. */
  path: string;
  /** The file name without the hash, such as `todo.handler.toggle.js`. */
  name: string;
  raw: number;
  gzip: number;
}

/**
 * What the landing page knows about the todo demo. `buildDemo` measures it at build time from
 * the compiled `examples/todo`, so the page never shows a hand-typed size or name.
 */
export interface DemoData {
  /** The frame document, under the base: `demo/`. */
  frame: string;
  /** The server-rendered frame document. */
  document: DemoFile;
  /** The inline listener of `renderListener()`. Its path is empty: it is not a request. */
  listener: DemoFile;
  /** The loader module, `idlip/client`. */
  loader: DemoFile;
  /** The chunk of the handler the second checkbox names. */
  handler: DemoFile;
  /** The binding chunk of the path that handler writes. */
  binding: DemoFile;
  /** Every handler, binding and list chunk: the component code of the app. */
  chunks: DemoFile[];
  /** The handler the second checkbox names, such as `toggle`. */
  handlerName: string;
  /** The message the second checkbox holds, the value of its `on:click`. */
  token: string;
  /** The model paths the handler writes, such as `todos.*.done`. */
  writes: string[];
  /** The markup of the second todo, as the server wrote it. */
  row: string;
  /** The `<script i-state>` element. */
  state: string;
  /** The todos of the first render, by text and done. */
  todos: { text: string; done: boolean }[];
}
