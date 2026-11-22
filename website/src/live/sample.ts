// oxlint-disable import/prefer-default-export
// A live sample in the page. The code becomes an editor, and the sample runs through the REPL
// pipeline: the page compiles, the REPL worker renders on the server side, and a frame of its
// own resumes the result. An edit runs it again once typing stops. `client/live.ts` loads this
// chunk when the first sample nears the viewport, and this chunk loads the compiler.
import { createEditor } from '../repl/editor.ts';
import { encodeFiles } from '../repl/files.ts';
import type { ReplFile } from '../repl/files.ts';
import { escapeHtml, highlight } from '../repl/highlight.ts';
import REPL_ICON from '../repl/icons.ts';
import type { Problem } from '../repl/project.ts';
import type * as RunModule from '../repl/run.ts';
import type { RunResult, Runner } from '../repl/run.ts';

/** What a sample is doing. One state at a time, shown in its bar. */
type Status =
  | { kind: 'loading' }
  | { kind: 'running' }
  | { kind: 'ran' }
  | { kind: 'blocked'; errors: number }
  | { kind: 'failed'; message: string };

/** The wait after the last key before the sample runs again. */
const DELAY = 400;

/** The compiler, the render worker and the service worker, loaded once for every sample. */
let pipeline: Promise<typeof RunModule> | undefined;
/** The stylesheet of the frames, which the site build writes next to the pages. */
let frameCss: Promise<string> | undefined;
/** Gives each sample its own ids for the tab panels. */
let samples = 0;

async function loadFrameCss(): Promise<string> {
  // This chunk is in `assets/`, and the stylesheet in `live/` next to it. A `new URL()` with a
  // literal path would make Vite bundle the source file instead.
  const url = import.meta.url.replace(/assets\/[^/]*$/, 'live/frame.css');
  frameCss ??= fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`The frame styles did not load: ${response.status}`);
    }
    return response.text();
  });
  return frameCss;
}

function query<T extends Element>(root: ParentNode, selector: string, type: new () => T): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new TypeError(`The live sample has no ${selector}`);
  }
  return element;
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

function formatBytes(bytes: number): string {
  return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;
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

function isSameFiles(a: readonly ReplFile[], b: readonly ReplFile[]): boolean {
  for (const [index, file] of a.entries()) {
    if (file.source !== b[index]?.source) {
      return false;
    }
  }
  return a.length === b.length;
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

/** Moves the focus between the tabs of a tab list with the arrow keys, Home and End. */
function moveFocus(list: HTMLElement, event: KeyboardEvent): void {
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  const at =
    document.activeElement instanceof HTMLElement ? tabs.indexOf(document.activeElement) : -1;
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

/** Marks one tab of a list as selected and gives it the roving tab stop. */
function selectTab(list: HTMLElement, selected: HTMLElement): void {
  for (const tab of list.querySelectorAll<HTMLElement>('[role="tab"]')) {
    tab.setAttribute('aria-selected', String(tab === selected));
    tab.tabIndex = tab === selected ? 0 : -1;
  }
}

/** Turns the server markup of a live sample into an editor, and runs the sample. */
export function startSample(root: HTMLElement): void {
  const id = `live-${++samples}`;
  const fileList = query(root, '.live-files', HTMLElement);
  const statusLine = query(root, '[data-live-status]', HTMLElement);
  const code = query(root, '[data-live-code]', HTMLElement);
  const problemList = query(root, '[data-live-problems]', HTMLElement);
  const outputTabs = query(root, '.live-tabs', HTMLElement);
  const resultPanel = query(root, '[data-live-result]', HTMLElement);
  const compiledPanel = query(root, '[data-live-compiled]', HTMLElement);
  const replLink = root.querySelector<HTMLAnchorElement>('[data-live-repl]');
  const copy = query(root, '[data-live-copy]', HTMLButtonElement);
  const originalLink = replLink?.href ?? '';

  // The files come from the highlighted code: its text is the source and one newline.
  const original: ReplFile[] = [];
  const sources = [...code.querySelectorAll<HTMLElement>('[data-live-source]')];
  for (const source of sources) {
    original.push({
      name: source.dataset.liveSource ?? '',
      source: source.textContent.slice(0, -1),
    });
  }
  const files = structuredClone(original);
  let active = 0;
  let problems: Problem[] = [];
  let status: Status = { kind: 'loading' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let runner: Runner | undefined;
  // Counts the runs, so the answer of an older run is dropped.
  let runs = 0;

  // One highlight layer stays for the editor. The others were only for the page without script.
  const layer = sources[0];
  for (const source of sources.slice(1)) {
    source.remove();
  }
  layer.dataset.replHighlight = '';
  layer.setAttribute('aria-hidden', 'true');
  const marks = document.createElement('div');
  marks.className = 'live-layer live-marks';
  marks.dataset.replMarks = '';
  marks.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('p');
  hint.id = `${id}-hint`;
  hint.className = 'visually-hidden';
  hint.textContent = 'Edits run the sample again. Tab indents. Press Escape, then Tab, to leave.';
  const input = document.createElement('textarea');
  input.className = 'live-layer live-input';
  input.dataset.replInput = '';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-describedby', hint.id);
  code.append(marks, input, hint);
  root.classList.add('is-live');

  const editor = createEditor(code, (source) => {
    files[active].source = source;
    copy.dataset.copy = source;
    changed();
  });

  // The output panels get ids, so each tab names the panel it controls.
  const panels = { result: resultPanel, compiled: compiledPanel };
  for (const tab of outputTabs.querySelectorAll<HTMLElement>('[data-live-tab]')) {
    const panel = tab.dataset.liveTab === 'compiled' ? compiledPanel : resultPanel;
    panel.id = `${id}-${tab.dataset.liveTab}`;
    tab.id = `${panel.id}-tab`;
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', tab.id);
  }

  const frame = document.createElement('iframe');
  frame.className = 'live-frame';
  frame.title = `Result of ${files[0].name}`;
  frame.hidden = true;
  const errorBox = document.createElement('div');
  errorBox.className = 'live-error';
  errorBox.hidden = true;
  resultPanel.append(frame, errorBox);

  function setStatus(next: Status): void {
    status = next;
    root.dataset.status = next.kind;
    switch (next.kind) {
      case 'loading': {
        statusLine.innerHTML = '<span class="live-spinner" aria-hidden="true"></span>Loading';
        break;
      }
      case 'running': {
        statusLine.innerHTML = '<span class="live-spinner" aria-hidden="true"></span>Running';
        break;
      }
      case 'ran': {
        statusLine.textContent = '';
        break;
      }
      case 'blocked': {
        statusLine.innerHTML = `${REPL_ICON.alert}${next.errors === 1 ? '1 error' : `${next.errors} errors`}`;
        break;
      }
      case 'failed': {
        statusLine.innerHTML = `${REPL_ICON.alert}Failed`;
        break;
      }
    }
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

  function getFileProblems(): Problem[] {
    const own: Problem[] = [];
    for (const problem of problems) {
      if (problem.file === files[active].name) {
        own.push(problem);
      }
    }
    return own;
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
        openFile(findFile(problem.file));
        editor.select(problem.start, Math.max(problem.end, problem.start));
      });
      item.append(button);
      items.push(item);
    }
    problemList.replaceChildren(...items);
    problemList.hidden = items.length === 0;
    editor.mark(getFileProblems());
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
    active = index;
    const tabs = fileList.querySelectorAll<HTMLElement>('[role="tab"]');
    selectTab(fileList, tabs[index]);
    editor.show(files[index].name, files[index].source);
    editor.mark(getFileProblems());
    // `client/copy.ts` copies the text of `data-copy`: the file the editor shows.
    copy.dataset.copy = files[index].source;
  }

  /** The compiled modules with their gzip sizes: none of them loads before an event needs it. */
  async function renderCompiled(result: RunResult): Promise<void> {
    const paths = new Map<string, string>();
    if (result.kind === 'served') {
      for (const chunk of result.chunks) {
        paths.set(`${chunk.file}\0${chunk.chunk}`, chunk.path);
      }
    }
    const rows: { title: string; note: string; code: string }[] = [];
    for (const file of result.project.files) {
      if (file.result.server !== '') {
        rows.push({
          title: `${file.name}, server`,
          note: 'renders the HTML',
          code: file.result.server,
        });
      }
      for (const chunk of file.result.client) {
        rows.push({
          title: paths.get(`${file.name}\0${chunk.chunk}`) ?? `${file.name} ${chunk.chunk}`,
          note: chunk.chunk.startsWith('handler')
            ? 'loads on its event'
            : 'loads when its value changes',
          code: chunk.code,
        });
      }
    }
    const sizes: Promise<number>[] = [];
    for (const row of rows) {
      sizes.push(measureGzip(row.code));
    }
    const measured = await Promise.all(sizes);
    let html = '';
    for (const [index, row] of rows.entries()) {
      html += `<details class="live-module"><summary>${REPL_ICON.chevron}<span class="live-module-name">${escapeHtml(row.title)}</span><span class="live-module-note">${escapeHtml(row.note)}</span><span class="live-module-size">${formatBytes(measured[index])}</span></summary><pre class="live-module-code" tabindex="0">${highlight(row.code, 'ts')}</pre></details>`;
    }
    compiledPanel.innerHTML =
      html === ''
        ? '<p class="live-empty">Nothing compiled.</p>'
        : `<p class="live-compiled-head"><span>Module</span><span>gzip</span></p>${html}`;
  }

  /** The REPL link opens the code as the editor shows it. */
  function updateLink(): void {
    if (replLink === null) {
      return;
    }
    if (isSameFiles(files, original)) {
      replLink.href = originalLink;
      return;
    }
    const url = new URL(originalLink);
    url.hash = encodeFiles(files);
    replLink.href = url.href;
  }

  function changed(): void {
    updateLink();
    // The status changes at once, so the frame never looks current for code it does not run.
    setStatus({ kind: 'running' });
    clearTimeout(timer);
    timer = setTimeout(() => {
      run().catch(fail);
    }, DELAY);
  }

  function fail(error: unknown): void {
    clearErrors();
    showError(getMessage(error));
    setStatus({ kind: 'failed', message: getMessage(error) });
  }

  async function run(): Promise<void> {
    clearTimeout(timer);
    const current = ++runs;
    if (runner === undefined) {
      setStatus({ kind: 'loading' });
    }
    pipeline ??= import('../repl/run.ts');
    const [module, css] = await Promise.all([pipeline, loadFrameCss()]);
    runner ??= module.createRunner();
    if (current !== runs) {
      return;
    }
    setStatus({ kind: 'running' });
    const result = await runner(structuredClone(files), css, true);
    if (current !== runs) {
      return;
    }
    problems = result.project.problems;
    renderProblems();
    renderCompiled(result).catch(fail);
    if (!result.project.ok) {
      setStatus({ kind: 'blocked', errors: countErrors(problems) });
      return;
    }
    if (result.kind === 'failed') {
      fail(result.message);
      return;
    }
    if (result.kind === 'served') {
      clearErrors();
      frame.hidden = false;
      frame.src = result.url;
    }
  }

  frame.addEventListener('load', () => {
    if (frame.contentWindow?.location.href === 'about:blank') {
      return;
    }
    syncTheme(frame);
    if (status.kind === 'running') {
      setStatus({ kind: 'ran' });
    }
  });

  window.addEventListener('message', (event) => {
    const data: unknown = event.data;
    if (event.source !== frame.contentWindow || typeof data !== 'object' || data === null) {
      return;
    }
    const height: unknown = Reflect.get(data, 'idlipHeight');
    if (typeof height === 'number') {
      frame.style.height = `${height}px`;
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

  for (const [index, tab] of fileList.querySelectorAll<HTMLElement>('[role="tab"]').entries()) {
    tab.addEventListener('click', () => {
      openFile(index);
    });
  }
  for (const tab of outputTabs.querySelectorAll<HTMLElement>('[data-live-tab]')) {
    tab.addEventListener('click', () => {
      selectTab(outputTabs, tab);
      for (const [name, panel] of Object.entries(panels)) {
        panel.hidden = name !== tab.dataset.liveTab;
      }
    });
  }
  for (const list of [fileList, outputTabs]) {
    list.addEventListener('keydown', (event) => {
      moveFocus(list, event);
    });
  }

  openFile(0);
  run().catch(fail);
}
