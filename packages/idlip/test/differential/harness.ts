/**
 * Renders one compiled module two ways: on the server from a model, and in the DOM by
 * patching the server render of another model through the client chunks. A branch changes
 * through its binding chunk, a row through its list chunk.
 */
import { compile } from '../../src/compiler/index.ts';
import { getChunkId } from '../../src/core/format.ts';
import type {
  Model,
  Page,
  PageState,
  Props,
  RenderContext,
  ServerModule,
} from '../../src/core/format.ts';
import { patchList } from '../../src/client/list/index.ts';
import * as clientExports from '../../src/client/patch/index.ts';
import { restartSub } from '../../src/client/subs/index.ts';
import * as serverExports from '../../src/server/index.ts';
import { compareTrees } from '../../src/testing/compare.ts';
import { bindImports, importHelpers, toDataUrl } from '../../src/testing/modules.ts';

export interface Subject {
  /** A name for reports. */
  readonly name: string;
  readonly source: string;
  readonly props: Props;
  /** The sources of the stateful children, by import specifier. The subject skips the root model pairs: `open` renders no child. */
  readonly children?: Readonly<Record<string, string>>;
  /**
   * True for a component that renders `<html>`. The harness loads its render as a whole document,
   * with the head output in `<head>`, and patches the document element.
   */
  readonly document?: true;
  /** Model pairs worth a run whatever the generator makes, from the initial model. */
  readonly pairs?: (initial: Model) => readonly (readonly [Model, Model])[];
}

export interface Opened {
  readonly name: string;
  /** The model of the server render from the props alone. */
  readonly initial: Model;
  /** The paths of the lists with their key fields, from the manifest. */
  readonly keys: ReadonlyMap<string, string | undefined>;
  /** The server render of a model, or undefined when the render throws. */
  render: (model: Model) => string | undefined;
  /**
   * Renders `from` on the server, patches the DOM to `to` through the chunks, and returns the
   * first difference from the server render of `to`. Returns undefined when the two match.
   */
  patch: (from: Model, to: Model) => Promise<string | undefined>;
  close: () => void;
}

let opened = 0;

/**
 * Writes the head output into the `<head>` of a document, as the stream does: the winning
 * title first, then the elements in block order.
 */
function writeHead(
  html: string,
  heads: readonly { id: number; markup: string; title: string | undefined }[],
): string {
  const sorted = heads.toSorted((a, b) => a.id - b.id);
  const titles = sorted.flatMap((entry) => (entry.title === undefined ? [] : [entry.title]));
  const output = [...titles.slice(-1), ...titles.slice(0, -1), ...sorted.map((e) => e.markup)];
  const start = html.indexOf('<head>') + '<head>'.length;
  return `${html.slice(0, start)}${output.join('')}${html.slice(start)}`;
}

/**
 * Returns the element of a fresh document parsed from `html`. Each pair gets its own document,
 * since the patch keeps the nodes it found for a root.
 */
function loadDocument(html: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const target = document.implementation.createHTMLDocument('');
  function copy(from: Element, to: Element): void {
    for (const attribute of from.attributes) {
      to.setAttribute(attribute.name, attribute.value);
    }
  }
  copy(parsed.documentElement, target.documentElement);
  copy(parsed.body, target.body);
  target.head.innerHTML = parsed.head.innerHTML;
  target.body.innerHTML = parsed.body.innerHTML;
  return target.documentElement;
}

async function importCode(code: string): Promise<unknown> {
  return import(/* @vite-ignore */ toDataUrl(code));
}

function isScript(node: Node): boolean {
  return node instanceof HTMLScriptElement;
}

/** Compiles and loads a subject. */
export async function open(subject: Subject): Promise<Opened> {
  const key = `$idlipDifferential${opened++}`;
  const id = '/src/app.tsx';
  const compiled = compile(subject.source, id);
  for (const item of compiled.diagnostics) {
    if (item.severity === 'error') {
      throw new Error(`${subject.name} does not compile: ${item.message}`);
    }
  }
  const scope = {
    server: { ...serverExports },
    client: { ...clientExports, patchList, restartSub },
    helpers: {},
    loaded() {},
  };
  Reflect.set(globalThis, key, scope);
  scope.helpers = await importHelpers(key);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const server = (await importCode(bindImports(compiled.server, key))) as ServerModule;

  const urls = new Map<string, string | undefined>();
  for (const chunk of compiled.client) {
    urls.set(
      getChunkId(compiled.manifest.module, chunk.chunk),
      toDataUrl(bindImports(chunk.code, key)),
    );
  }

  function renderState(model: Model | undefined): { html: string; state: PageState } | undefined {
    let recorded: PageState | undefined;
    const heads: { id: number; markup: string; title: string | undefined }[] = [];
    let next = 0;
    const context: RenderContext = {
      state(state) {
        recorded ??= state;
      },
      headId: () => next++,
      head(block, markup, title) {
        heads.push({ id: block, markup, title });
      },
    };
    try {
      let html = server.default(subject.props, context, model);
      if (subject.document === true) {
        html = writeHead(html, heads);
      }
      return recorded === undefined ? undefined : { html, state: recorded };
    } catch {
      return undefined;
    }
  }

  const first = renderState(undefined);
  if (first === undefined) {
    throw new Error(`${subject.name} does not render on the server`);
  }

  const keys = new Map<string, string | undefined>();
  for (const list of Object.values(compiled.manifest.lists)) {
    if (list.path !== undefined) {
      keys.set(list.path, list.key);
    }
  }

  return {
    name: subject.name,
    initial: first.state.model,
    keys,
    render: (model) => renderState(model)?.html,
    async patch(from, to) {
      const before = renderState(from);
      const after = renderState(to);
      if (before === undefined || after === undefined) {
        throw new Error('The server cannot render this pair');
      }
      const root =
        subject.document === true ? loadDocument(before.html) : document.createElement('div');
      if (subject.document !== true) {
        root.innerHTML = before.html;
        document.body.append(root);
      }
      try {
        const page: Page = {
          root,
          manifest: compiled.manifest,
          props: subject.props,
          // oxlint-disable-next-line typescript/promise-function-async
          load: (module, chunk) => {
            const url = urls.get(getChunkId(module, chunk));
            if (url === undefined) {
              throw new Error(`No chunk ${chunk}`);
            }
            return import(/* @vite-ignore */ url);
          },
          // The patch records what each hole read, so every pair starts from its own copy.
          dynamic: structuredClone(before.state.dynamic),
        };
        await clientExports.createPatch(patchList)(page, from, to);
        if (subject.document === true) {
          const parsed = new DOMParser().parseFromString(after.html, 'text/html');
          // The roots are the document elements, so compare the documents to include their attributes.
          return compareTrees(root.ownerDocument, parsed, isScript);
        }
        const fresh = document.createElement('div');
        fresh.innerHTML = after.html;
        return compareTrees(root, fresh, isScript);
      } finally {
        if (subject.document !== true) {
          root.remove();
        }
      }
    },
    close() {
      Reflect.deleteProperty(globalThis, key);
    },
  };
}
