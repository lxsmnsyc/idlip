// oxlint-disable import/prefer-default-export
// The REPL page: files and the editor on one side, the output tabs on the other. Each edit
// compiles the files in the REPL worker and, when they compile, runs them in the frame. Files
// from a share link only compile until the reader chooses Run.
import type { NetworkPanel, watchFrame } from '../client/lib/network.ts';
import { listFileChunks } from './chunks.ts';
import { createEditor } from './editor.ts';
import { EXAMPLES } from './examples.ts';
import {
  PROPS_FILE,
  encodeFiles,
  getExampleHash,
  getSampleFiles,
  getSampleHash,
  isModuleName,
  readHash,
} from './files.ts';
import type { ReplFile } from './files.ts';
import { escapeHtml, highlight } from './highlight.ts';
import REPL_ICON from './icons.ts';
import type { Problem } from './project.ts';
import type { RunResult } from './run.ts';

/** What the REPL is doing. One state at a time, shown in the status line. */
type Status =
  | { kind: 'loading' }
  | { kind: 'compiling' }
  | { kind: 'waiting' }
  | { kind: 'running' }
  | { kind: 'ran' }
  | { kind: 'blocked'; errors: number }
  | { kind: 'failed'; message: string };

/** The wait after the last key before the files compile. */
const DELAY = 350;

const NEW_FILE = `import type { JSX } from 'idlip/jsx-runtime';

export default function Part(): JSX.Element {
  return <p>A new file</p>;
}
`;

function query<T extends Element>(root: ParentNode, selector: string, type: new () => T): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new TypeError(`The REPL page has no ${selector}`);
  }
  return element;
}

function copyFiles(files: readonly ReplFile[]): ReplFile[] {
  const copy: ReplFile[] = [];
  for (const file of files) {
    copy.push({ ...file });
  }
  return copy;
}

function isSameFiles(a: readonly ReplFile[], b: readonly ReplFile[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (const [index, file] of a.entries()) {
    if (file.name !== b[index].name || file.source !== b[index].source) {
      return false;
    }
  }
  return true;
}

function findFile(files: readonly ReplFile[], name: string): ReplFile | undefined {
  for (const file of files) {
    if (file.name === name) {
      return file;
    }
  }
  return undefined;
}

function isSamples(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  for (const source of Object.values(value)) {
    if (typeof source !== 'string') {
      return false;
    }
  }
  return true;
}

function findExample(files: readonly ReplFile[]): string {
  for (const example of EXAMPLES) {
    if (isSameFiles(example.files, files)) {
      return example.id;
    }
  }
  return '';
}

/** Moves the focus between the tabs of a tab list with the arrow keys, Home and End. */
function moveFocus(list: HTMLElement, event: KeyboardEvent): void {
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  const focused = document.activeElement;
  const at = focused instanceof HTMLElement ? tabs.indexOf(focused) : -1;
  if (at === -1) {
    return;
  }
  let next: number;
  if (event.key === 'ArrowRight') {
    next = (at + 1) % tabs.length;
  } else if (event.key === 'ArrowLeft') {
    next = (at - 1 + tabs.length) % tabs.length;
  } else if (event.key === 'Home') {
    next = 0;
  } else if (event.key === 'End') {
    next = tabs.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

function findPanel(root: HTMLElement): NetworkPanel {
  return {
    load: query(root, '[data-net-load]', HTMLElement),
    events: query(root, '[data-net-events]', HTMLElement),
    loadCode: query(root, '[data-net-code-load]', HTMLElement),
    eventsCode: query(root, '[data-net-code-events]', HTMLElement),
  };
}

/** Gives the frame the theme the page shows, chosen or from the system. */
function syncTheme(frame: HTMLIFrameElement): void {
  const root = frame.contentDocument?.documentElement;
  const theme = document.documentElement.dataset.theme;
  if (!root) {
    return;
  }
  if (theme === undefined) {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

function logError(error: unknown): void {
  // oxlint-disable-next-line no-console
  console.error(error);
}

function describeProblem(problem: Problem): string {
  return `${problem.file}:${problem.line}:${problem.column}`;
}

function renderModule(title: string, file: string, code: string): string {
  return `<section class="repl-module"><h3 class="repl-module-title">${escapeHtml(title)}<span>${escapeHtml(file)}</span></h3><pre class="repl-out" tabindex="0">${highlight(code, 'ts')}</pre></section>`;
}

/**
 * Starts the REPL in its page. `watch` is the network panel of the site script, passed in so the
 * site script and this chunk share no module, and docs pages load one script.
 */
export function startRepl(root: HTMLElement, watch: typeof watchFrame): void {
  const fileTabs = query(root, '[data-repl-files]', HTMLElement);
  const addForm = query(root, '[data-repl-add]', HTMLFormElement);
  const addInput = query(addForm, 'input', HTMLInputElement);
  const picker = query(root, '[data-repl-example]', HTMLSelectElement);
  const share = query(root, '[data-repl-share]', HTMLButtonElement);
  const shareLabel = query(share, '[data-repl-share-label]', HTMLElement);
  const statusLine = query(root, '[data-repl-status]', HTMLElement);
  const errorBox = query(root, '[data-repl-error]', HTMLElement);
  const frame = query(root, '[data-repl-frame]', HTMLIFrameElement);
  const address = query(root, '[data-repl-address]', HTMLElement);
  const reload = query(root, '[data-repl-reload]', HTMLButtonElement);
  const outputTabs = query(root, '.repl-tabs', HTMLElement);
  const count = query(root, '[data-repl-count]', HTMLElement);
  const jsPanel = query(root, '[data-repl-js]', HTMLElement);
  const statePanel = query(root, '[data-repl-state]', HTMLElement);
  const htmlPanel = query(root, '[data-repl-html]', HTMLElement);
  const problemList = query(root, '[data-repl-problems]', HTMLElement);
  const fileProblems = query(root, '[data-repl-file-problems]', HTMLElement);
  const undo = query(root, '[data-repl-undo]', HTMLButtonElement);
  const runButton = query(root, '[data-repl-run]', HTMLButtonElement);
  const panel = findPanel(root);
  const css =
    document.querySelector<HTMLTemplateElement>('template[data-repl-frame-css]')?.content
      .textContent ?? '';

  let files = copyFiles(EXAMPLES[0].files);
  let active = files[0].name;
  let problems: Problem[] = [];
  let status: Status = { kind: 'loading' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopWatch = (): void => {};
  let shareReset: ReturnType<typeof setTimeout> | undefined;
  // Files run on their own only when their code came from the site: an example, a docs
  // sample, or edits the reader made after choosing Run.
  let trusted = false;
  // The docs sample the files came from, so the hash keeps naming it until an edit.
  let sample: { id: string; files: ReplFile[] } | undefined;
  // Counts the runs, so the answer of an older run is dropped.
  let runs = 0;
  const loading = import('./run.ts');

  const editor = createEditor(root, (source) => {
    const file = findFile(files, active);
    if (file !== undefined) {
      file.source = source;
    }
    changed();
  });

  for (const example of EXAMPLES) {
    const option = document.createElement('option');
    option.value = example.id;
    option.textContent = example.label;
    picker.append(option);
  }

  function setStatus(next: Status): void {
    status = next;
    root.dataset.status = next.kind;
    switch (next.kind) {
      case 'loading': {
        statusLine.textContent = 'Loading the compiler';
        break;
      }
      case 'compiling': {
        statusLine.textContent = 'Compiling';
        break;
      }
      case 'waiting': {
        statusLine.textContent = 'This code came in a link. It runs when you choose Run.';
        break;
      }
      case 'running': {
        statusLine.textContent = 'Rendered on the server. Resuming in the frame.';
        break;
      }
      case 'ran': {
        statusLine.textContent = 'Resumed. Use the page: the panel lists each chunk it loads.';
        break;
      }
      case 'blocked': {
        statusLine.textContent = `${next.errors === 1 ? 'An error stops' : `${next.errors} errors stop`} the run. See Problems.`;
        break;
      }
      case 'failed': {
        statusLine.textContent = next.message;
        break;
      }
    }
    runButton.hidden = next.kind !== 'waiting';
  }

  function showError(message: string): void {
    const line = document.createElement('p');
    line.textContent = message;
    errorBox.append(line);
    errorBox.hidden = false;
  }

  function clearErrors(): void {
    errorBox.replaceChildren();
    errorBox.hidden = true;
  }

  // A deleted file comes back with the undo button until the next delete or 8 seconds.
  let deleted: { file: ReplFile; index: number } | undefined;
  let undoReset: ReturnType<typeof setTimeout> | undefined;

  function hideUndo(): void {
    deleted = undefined;
    undo.hidden = true;
  }

  function removeFile(name: string): void {
    const kept: ReplFile[] = [];
    for (const [index, file] of files.entries()) {
      if (file.name === name) {
        deleted = { file, index };
      } else {
        kept.push(file);
      }
    }
    files = kept;
    undo.textContent = `Restore ${name}`;
    undo.hidden = false;
    clearTimeout(undoReset);
    undoReset = setTimeout(hideUndo, 8000);
    if (active === name) {
      active = files[0].name;
    }
    changed();
    openFile(active);
  }

  function renderFileTabs(): void {
    const items: HTMLElement[] = [];
    for (const [index, file] of files.entries()) {
      const item = document.createElement('div');
      item.className = 'repl-file';
      item.setAttribute('role', 'presentation');
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'repl-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(file.name === active));
      tab.tabIndex = file.name === active ? 0 : -1;
      tab.textContent = file.name;
      let errors = 0;
      for (const problem of problems) {
        if (problem.file === file.name && problem.severity === 'error') {
          errors++;
        }
      }
      if (errors > 0) {
        tab.classList.add('has-error');
        tab.setAttribute('aria-description', `${errors} ${errors === 1 ? 'error' : 'errors'}`);
      }
      tab.addEventListener('click', () => {
        openFile(file.name);
      });
      item.append(tab);
      // The first file is the page, so it stays.
      if (index > 0) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'icon-button repl-remove';
        remove.setAttribute('aria-label', `Delete ${file.name}`);
        remove.title = `Delete ${file.name}`;
        remove.innerHTML = REPL_ICON.close;
        remove.addEventListener('click', () => {
          removeFile(file.name);
        });
        item.append(remove);
      }
      items.push(item);
    }
    fileTabs.replaceChildren(...items);
  }

  function getFileMarks(): Problem[] {
    const marks: Problem[] = [];
    for (const problem of problems) {
      if (problem.file === active) {
        marks.push(problem);
      }
    }
    return marks;
  }

  function createProblemButton(problem: Problem, withFile: boolean): HTMLLIElement {
    const item = document.createElement('li');
    item.className = `repl-problem is-${problem.severity}`;
    const button = document.createElement('button');
    button.type = 'button';
    const place = document.createElement('span');
    place.className = 'repl-problem-place';
    place.textContent = withFile ? describeProblem(problem) : `${problem.line}:${problem.column}`;
    const text = document.createElement('span');
    text.textContent = `${problem.severity === 'error' ? 'Error' : 'Warning'}: ${problem.message}`;
    button.append(place, text);
    button.addEventListener('click', () => {
      openFile(problem.file);
      editor.select(problem.start, Math.max(problem.end, problem.start));
    });
    item.append(button);
    return item;
  }

  function renderProblems(): void {
    const all: HTMLLIElement[] = [];
    const own: HTMLLIElement[] = [];
    for (const problem of problems) {
      all.push(createProblemButton(problem, true));
      if (problem.file === active) {
        own.push(createProblemButton(problem, false));
      }
    }
    if (all.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'net-empty';
      empty.textContent = 'No problems';
      all.push(empty);
    }
    problemList.replaceChildren(...all);
    fileProblems.replaceChildren(...own);
    count.textContent = String(problems.length);
    count.classList.toggle('has-error', !problemsOk());
    editor.mark(getFileMarks());
    renderFileTabs();
  }

  function problemsOk(): boolean {
    for (const problem of problems) {
      if (problem.severity === 'error') {
        return false;
      }
    }
    return true;
  }

  function openFile(name: string): void {
    const file = findFile(files, name) ?? files[0];
    active = file.name;
    editor.show(file.name, file.source);
    editor.mark(getFileMarks());
    renderProblems();
  }

  function renderOutput(result: RunResult): void {
    // The code as the compiler wrote it, with the file name each chunk has in the run.
    let js = '';
    const served = result.kind === 'served' ? result : undefined;
    const paths = new Map<string, string>();
    for (const chunk of served?.chunks ?? []) {
      paths.set(`${chunk.file}\0${chunk.chunk}`, chunk.path);
    }
    for (const file of result.project.files) {
      if (file.result.server !== '') {
        js += renderModule(
          `${file.name}: server module`,
          'runs in the REPL worker',
          file.result.server,
        );
      }
      for (const chunk of listFileChunks(file)) {
        js += renderModule(
          `${file.name}: ${chunk.chunk}`,
          paths.get(`${file.name}\0${chunk.chunk}`) ?? '',
          chunk.code,
        );
      }
    }
    jsPanel.innerHTML = js === '' ? '<p class="net-empty">Nothing compiled</p>' : js;
    const body = served?.rendered.body ?? '';
    const state = /<script i-state[^>]*>([\s\S]*?)<\/script>/.exec(body);
    statePanel.innerHTML = state ? highlight(state[1], 'ts') : 'No state: the run did not render.';
    const markup = body.replace(/<script i-state[\s\S]*?<\/script>/, '');
    const head = served?.rendered.head ?? '';
    htmlPanel.innerHTML =
      served === undefined
        ? 'No markup: the run did not render.'
        : highlight(`${head === '' ? '' : `${head}\n\n`}${markup}`, 'html');
  }

  /** The hash names the example or the docs sample the files still match, or holds the files. */
  function saveHash(): void {
    const example = findExample(files);
    let hash = encodeFiles(files);
    if (example !== '') {
      hash = getExampleHash(example);
    } else if (sample !== undefined && isSameFiles(sample.files, files)) {
      hash = getSampleHash(sample.id);
    }
    history.replaceState(null, '', hash);
    picker.value = example;
  }

  function changed(): void {
    saveHash();
    // The status changes at once, so the frame never looks current for code it does not run.
    setStatus({ kind: 'compiling' });
    clearTimeout(timer);
    timer = setTimeout(() => {
      execute().catch(logError);
    }, DELAY);
  }

  function fail(message: string): void {
    clearErrors();
    showError(message);
    setStatus({ kind: 'failed', message: 'The run failed. The error is above the frame.' });
  }

  async function execute(): Promise<void> {
    clearTimeout(timer);
    const run = ++runs;
    setStatus({ kind: 'compiling' });
    let result: RunResult;
    try {
      const { runFiles } = await loading;
      result = await runFiles(copyFiles(files), `<style>${css}</style>`, trusted);
    } catch (error) {
      if (run === runs) {
        fail(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (run !== runs) {
      return;
    }
    problems = result.project.problems;
    renderProblems();
    renderOutput(result);
    if (!result.project.ok) {
      let errors = 0;
      for (const problem of problems) {
        if (problem.severity === 'error') {
          errors++;
        }
      }
      setStatus({ kind: 'blocked', errors });
      return;
    }
    switch (result.kind) {
      case 'compiled': {
        setStatus({ kind: 'waiting' });
        break;
      }
      case 'failed': {
        fail(result.message);
        break;
      }
      case 'served': {
        clearErrors();
        setStatus({ kind: 'running' });
        address.textContent = new URL(result.url).pathname;
        frame.src = result.url;
        break;
      }
    }
  }

  /** Shows the files a hash names. Only an example or a docs sample runs at once. */
  async function load(hash: string): Promise<void> {
    const read = readHash(hash);
    let next = copyFiles(EXAMPLES[0].files);
    trusted = true;
    sample = undefined;
    let missing = '';
    switch (read.kind) {
      case 'none': {
        break;
      }
      case 'example': {
        for (const example of EXAMPLES) {
          if (example.id === read.id) {
            next = copyFiles(example.files);
          }
        }
        break;
      }
      case 'sample': {
        const source = await readSample(read.id);
        if (source === undefined) {
          missing = read.id;
        } else {
          sample = { id: read.id, files: getSampleFiles(source) };
          next = copyFiles(sample.files);
        }
        break;
      }
      case 'files': {
        next = read.files;
        trusted = false;
        break;
      }
    }
    files = next;
    problems = [];
    openFile(files[0].name);
    saveHash();
    await execute();
    // After the run, which clears the errors of the run before it.
    if (missing !== '') {
      showError(`This site has no docs sample ${missing}. The REPL shows the counter.`);
    }
  }

  /** The source of a docs sample, from the file the site build writes. */
  async function readSample(id: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${root.dataset.base ?? '/'}repl/samples.json`);
      const samples: unknown = await response.json();
      return isSamples(samples) && Object.hasOwn(samples, id) ? samples[id] : undefined;
    } catch {
      return undefined;
    }
  }

  frame.addEventListener('load', () => {
    stopWatch();
    if (frame.contentWindow?.location.href === 'about:blank') {
      return;
    }
    syncTheme(frame);
    stopWatch = watch(frame, panel);
    // The panel's own hint names the todo of the landing page.
    const empty = panel.events.querySelector('.net-empty');
    if (empty) {
      empty.textContent = 'Nothing yet. Click in the page.';
    }
    if (status.kind === 'running') {
      setStatus({ kind: 'ran' });
    }
  });

  window.addEventListener('message', (event) => {
    const data: unknown = event.data;
    if (event.source !== frame.contentWindow || typeof data !== 'object' || data === null) {
      return;
    }
    const message: unknown = Reflect.get(data, 'message');
    if (typeof message === 'string' && Reflect.get(data, 'idlipRepl') !== undefined) {
      showError(`In the frame: ${message}`);
    }
  });

  new MutationObserver(() => {
    syncTheme(frame);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  reload.addEventListener('click', () => {
    execute().catch(logError);
  });

  // The reader chose to run the files. Their edits run on their own from now on.
  runButton.addEventListener('click', () => {
    trusted = true;
    execute().catch(logError);
  });

  picker.addEventListener('change', () => {
    let picked: ReplFile[] | undefined;
    for (const example of EXAMPLES) {
      if (example.id === picker.value) {
        picked = example.files;
      }
    }
    if (picked === undefined) {
      return;
    }
    files = copyFiles(picked);
    active = files[0].name;
    problems = [];
    openFile(active);
    changed();
  });

  share.addEventListener('click', () => {
    saveHash();
    clearTimeout(shareReset);
    navigator.clipboard.writeText(location.href).then(
      () => {
        share.classList.add('is-done');
        shareLabel.textContent = 'Copied';
      },
      () => {
        shareLabel.textContent = 'Failed. Copy the address bar.';
      },
    );
    shareReset = setTimeout(() => {
      share.classList.remove('is-done');
      shareLabel.textContent = 'Copy the link';
    }, 1500);
  });

  undo.addEventListener('click', () => {
    if (deleted !== undefined && findFile(files, deleted.file.name) === undefined) {
      files.splice(Math.min(deleted.index, files.length), 0, deleted.file);
      const name = deleted.file.name;
      hideUndo();
      changed();
      openFile(name);
    }
  });

  addInput.addEventListener('input', () => {
    addInput.setCustomValidity('');
  });
  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = addInput.value.trim();
    let problem = '';
    if (!isModuleName(name) && name !== PROPS_FILE) {
      problem = `Name it like part.tsx, or ${PROPS_FILE}`;
    } else if (findFile(files, name) !== undefined) {
      problem = `${name} is a file already`;
    }
    addInput.setCustomValidity(problem);
    if (problem !== '') {
      addInput.reportValidity();
      return;
    }
    files.push({ name, source: name === PROPS_FILE ? '{}\n' : NEW_FILE });
    addInput.value = '';
    changed();
    openFile(name);
  });

  for (const list of [fileTabs, outputTabs]) {
    list.addEventListener('keydown', (event) => {
      moveFocus(list, event);
    });
  }

  for (const tab of outputTabs.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    tab.addEventListener('click', () => {
      for (const other of outputTabs.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
        const selected = other === tab;
        other.setAttribute('aria-selected', String(selected));
        other.tabIndex = selected ? 0 : -1;
        const target = document.getElementById(other.getAttribute('aria-controls') ?? '');
        if (target) {
          target.hidden = !selected;
        }
      }
    });
  }

  // A link to another example, sample or set of files, opened in this tab.
  window.addEventListener('hashchange', () => {
    load(location.hash).catch(logError);
  });

  setStatus({ kind: 'loading' });
  load(location.hash).catch(logError);
}
