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
import { bindImports, toDataUrl } from '../../src/testing/modules.ts';

export interface Subject {
  /** A name for reports. */
  readonly name: string;
  readonly source: string;
  readonly props: Props;
  /** The sources of the stateful children, by import specifier. The subject then runs by handlers only. */
  readonly children?: Readonly<Record<string, string>>;
  /** Model pairs worth a run whatever the generator makes, from the initial model. */
  readonly pairs?: (initial: Model) => readonly (readonly [Model, Model])[];
  /**
   * Selects the elements the handler run clicks. The check renders a child from its initial
   * model, so a run with children clicks only what changes the root. Default: every `on:click`.
   */
  readonly clicks?: string;
}

export interface Opened {
  readonly name: string;
  /** The model of the server render from the props alone. */
  readonly initial: Model;
  /** The paths of the lists with their key fields, from the manifest. */
  readonly keys: ReadonlyMap<string, string>;
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
  Reflect.set(globalThis, key, {
    server: { ...serverExports },
    client: { ...clientExports, patchList, restartSub },
    loaded() {},
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const server = (await importCode(bindImports(compiled.server, key))) as ServerModule;

  const urls = new Map<string, string>();
  for (const chunk of compiled.client) {
    urls.set(
      getChunkId(compiled.manifest.module, chunk.chunk),
      toDataUrl(bindImports(chunk.code, key)),
    );
  }

  function renderState(model: Model | undefined): { html: string; state: PageState } | undefined {
    let recorded: PageState | undefined;
    const context: RenderContext = {
      state(next) {
        recorded ??= next;
      },
      headId: () => 0,
      head() {},
    };
    try {
      const html = server.default(subject.props, context, model);
      return recorded === undefined ? undefined : { html, state: recorded };
    } catch {
      return undefined;
    }
  }

  const first = renderState(undefined);
  if (first === undefined) {
    throw new Error(`${subject.name} does not render on the server`);
  }

  const keys = new Map<string, string>();
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
      const root = document.createElement('div');
      root.innerHTML = before.html;
      document.body.append(root);
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
        const fresh = document.createElement('div');
        fresh.innerHTML = after.html;
        return compareTrees(root, fresh, isScript);
      } finally {
        root.remove();
      }
    },
    close() {
      Reflect.deleteProperty(globalThis, key);
    },
  };
}
