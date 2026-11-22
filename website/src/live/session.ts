// oxlint-disable import/prefer-default-export
// The editing session of a live sample: the highlighting editor, and runs through the REPL
// pipeline. The page compiles, the REPL worker renders on the server side, and the sample's frame
// switches from the static page to the run. `sample.ts` loads this chunk on the first focus or key
// in a sample, and this chunk loads the compiler on the first edit.
import { createEditor } from '../repl/editor.ts';
import { highlight } from '../repl/highlight.ts';
import REPL_ICON from '../repl/icons.ts';
import type { Problem } from '../repl/project.ts';
import type * as RunModule from '../repl/run.ts';
import type { RunResult, Runner } from '../repl/run.ts';
import { listCompiledModules, renderCompiled } from './compiled.ts';
import type { CompiledRow } from './compiled.ts';
import { LOAD_FAILED } from './sample.ts';
import type { SampleView } from './sample.ts';

/** The wait after the last key before the sample runs again. */
const DELAY = 400;

/** The compiler, the render worker and the service worker. A failed load is tried again. */
let pipeline: Promise<typeof RunModule> | undefined;

async function loadPipeline(): Promise<typeof RunModule> {
  pipeline ??= import('../repl/run.ts').catch((error: unknown) => {
    pipeline = undefined;
    throw error;
  });
  return pipeline;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The size of a text in gzip, as a server would send it. */
async function measureGzip(text: string): Promise<number> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = await new Response(stream).arrayBuffer();
  return compressed.byteLength;
}

function countErrors(problems: readonly Problem[]): number {
  let errors = 0;
  for (const problem of problems) {
    if (problem.severity === 'error') {
      errors++;
    }
  }
  return errors;
}

/** Takes over a sample: its code becomes the highlighting editor, and edits run it. */
export function attachSession(view: SampleView): void {
  const { files, frame } = view;
  let problems: Problem[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let runner: Runner | undefined;
  // Counts the runs, so the answer of an older run is dropped.
  let runs = 0;
  let waitingFrame = false;

  // One highlight layer stays for the editor. The others were only for the code before it.
  const sources = [...view.code.querySelectorAll<HTMLElement>('[data-live-source]')];
  const layer = sources[0];
  for (const source of sources.slice(1)) {
    source.remove();
  }
  layer.dataset.replHighlight = '';
  layer.classList.add('is-shown');

  const editor = createEditor(view.code, (source) => {
    files[view.active()].source = source;
    view.copy.dataset.copy = source;
    changed();
  });

  function getFileProblems(): Problem[] {
    const own: Problem[] = [];
    for (const problem of problems) {
      if (problem.file === files[view.active()].name) {
        own.push(problem);
      }
    }
    return own;
  }

  /** The index of a file by name, or the first file. */
  function findFile(name: string): number {
    for (const [index, file] of files.entries()) {
      if (file.name === name) {
        return index;
      }
    }
    return 0;
  }

  function openFile(index: number): void {
    editor.show(files[index].name, files[index].source);
    editor.mark(getFileProblems());
  }

  function renderProblems(): void {
    const items: HTMLLIElement[] = [];
    for (const problem of problems) {
      const item = document.createElement('li');
      item.className = `live-problem is-${problem.severity}`;
      const button = document.createElement('button');
      button.type = 'button';
      const place = document.createElement('span');
      place.className = 'live-problem-place';
      place.textContent =
        files.length > 1
          ? `${problem.file}:${problem.line}:${problem.column}`
          : `${problem.line}:${problem.column}`;
      const text = document.createElement('span');
      text.textContent = problem.message;
      button.innerHTML = REPL_ICON.alert;
      button.append(place, text);
      button.addEventListener('click', () => {
        const tabs = view.fileList.querySelectorAll<HTMLElement>('[role="tab"]');
        tabs[findFile(problem.file)].click();
        editor.select(problem.start, Math.max(problem.end, problem.start));
      });
      item.append(button);
      items.push(item);
    }
    view.problemList.replaceChildren(...items);
    view.problemList.hidden = items.length === 0;
    editor.mark(getFileProblems());
  }

  /** The Compiled tab of a run, with gzip sizes. */
  async function renderRun(result: RunResult, current: number): Promise<void> {
    const chunks = result.kind === 'served' ? result.chunks : [];
    const modules = listCompiledModules(result.project, chunks);
    const sizes: Promise<number>[] = [];
    for (const module of modules) {
      sizes.push(measureGzip(module.code));
    }
    const measured = await Promise.all(sizes);
    if (current !== runs) {
      return;
    }
    const rows: CompiledRow[] = [];
    for (const [index, module] of modules.entries()) {
      rows.push({
        title: module.title,
        note: module.note,
        size: measured[index],
        html: highlight(module.code, 'ts'),
      });
    }
    view.markCompiled();
    view.compiledPanel.innerHTML = renderCompiled(rows);
  }

  function changed(): void {
    // The status changes at once, so the frame never looks current for code it does not run.
    view.setStatus({ kind: 'running' });
    clearTimeout(timer);
    timer = setTimeout(() => {
      run().catch((error: unknown) => {
        view.setStatus({ kind: 'failed', message: getMessage(error) });
        view.showError(getMessage(error));
      });
    }, DELAY);
  }

  async function run(): Promise<void> {
    clearTimeout(timer);
    const current = ++runs;
    // The errors belong to the code before this edit.
    view.clearErrors();

    let module: typeof RunModule;
    try {
      module = await loadPipeline();
    } catch {
      if (current === runs) {
        view.setStatus({ kind: 'failed', message: LOAD_FAILED });
        view.showError(LOAD_FAILED);
      }
      return;
    }
    runner ??= module.createRunner();
    if (current !== runs) {
      return;
    }
    view.setStatus({ kind: 'running' });
    const result = await runner(structuredClone(files), view.styles, true);
    if (current !== runs) {
      return;
    }

    problems = result.project.problems;
    renderProblems();
    renderRun(result, current).catch((error: unknown) => {
      if (current === runs) {
        view.showError(getMessage(error));
      }
    });
    if (!result.project.ok) {
      view.setStatus({ kind: 'blocked', errors: countErrors(problems) });
      return;
    }
    if (result.kind === 'failed') {
      view.setStatus({ kind: 'failed', message: result.message });
      view.showError(result.message);
      return;
    }
    if (result.kind === 'served') {
      waitingFrame = true;
      // A lazy frame does not follow a new `src` in Chromium. The sample is in view by now.
      frame.loading = 'eager';
      frame.src = result.url;
    }
  }

  frame.addEventListener('load', () => {
    if (waitingFrame) {
      waitingFrame = false;
      view.setStatus({ kind: 'ready' });
    }
  });

  view.onFile = openFile;
  openFile(view.active());
  // Keys typed while this chunk loaded run now. Otherwise the static frame stays until an edit.
  let edited = false;
  for (const [index, file] of files.entries()) {
    if (file.source !== view.original[index].source) {
      edited = true;
    }
  }
  if (edited) {
    changed();
  } else {
    view.setStatus({ kind: 'ready' });
  }
}
