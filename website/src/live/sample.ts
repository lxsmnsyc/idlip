// oxlint-disable import/prefer-default-export
// A live sample for a reader. The result is the static frame the site build wrote, so reading
// costs the loader and the sample's chunks. The code takes edits at once, as plain text. The
// editor, the highlighter and the compiler load on the first focus or key in the code (and start
// loading on hover), in `session.ts`, which runs the edits.
import type { ReplFile } from '../repl/files.ts';
import REPL_ICON from '../repl/icons.ts';
import type * as SessionModule from './session.ts';

/** What a sample is doing. One state at a time, shown in its bar. */
export type Status =
  /** The static frame or the last run shows the code as it is. */
  | { kind: 'ready' }
  | { kind: 'loading' }
  | { kind: 'running' }
  | { kind: 'blocked'; errors: number }
  | { kind: 'failed'; message: string };

/** The parts of a sample that the session takes over. */
export interface SampleView {
  root: HTMLElement;
  code: HTMLElement;
  input: HTMLTextAreaElement;
  fileList: HTMLElement;
  problemList: HTMLElement;
  compiledPanel: HTMLElement;
  frame: HTMLIFrameElement;
  copy: HTMLButtonElement;
  /** The files as the editor shows them, and as the page shipped them. */
  files: ReplFile[];
  original: readonly ReplFile[];
  active: () => number;
  /** The address of the frame stylesheet, for the frames of runs. */
  styles: string;
  setStatus: (next: Status) => void;
  showError: (message: string) => void;
  clearErrors: () => void;
  /** Set when the session runs, so the Compiled tab shows the runs from then on. */
  markCompiled: () => void;
  /** Called after a file tab is chosen. The session sets it. */
  onFile?: (index: number) => void;
}

/** The message a sample shows when its code does not load. */
export const LOAD_FAILED = 'Could not load the compiler. Check the connection.';

/** The editing session, loaded once for every sample of the page. A failed load is tried again. */
let session: Promise<typeof SessionModule> | undefined;
/** Gives each sample its own ids for the tab panels. */
let samples = 0;

async function loadSession(): Promise<typeof SessionModule> {
  session ??= import('./session.ts').catch((error: unknown) => {
    session = undefined;
    throw error;
  });
  return session;
}

function query<T extends Element>(root: ParentNode, selector: string, type: new () => T): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new TypeError(`The live sample has no ${selector}`);
  }
  return element;
}

/**
 * Gives the frame the theme the page shows, chosen or from the system. The frame can run reader
 * code without an origin, so the page does not reach into it: the theme goes by message, which
 * the bridge of the frame's document reads. The bridge answers with the frame's height.
 */
function syncTheme(frame: HTMLIFrameElement): void {
  frame.contentWindow?.postMessage(
    { idlipTheme: document.documentElement.dataset.theme ?? null },
    '*',
  );
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
export function selectTab(list: HTMLElement, selected: HTMLElement): void {
  for (const tab of list.querySelectorAll<HTMLElement>('[role="tab"]')) {
    tab.setAttribute('aria-selected', String(tab === selected));
    tab.tabIndex = tab === selected ? 0 : -1;
  }
}

function isSameFiles(a: readonly ReplFile[], b: readonly ReplFile[]): boolean {
  for (const [index, file] of a.entries()) {
    if (file.source !== b[index]?.source) {
      return false;
    }
  }
  return a.length === b.length;
}

/** Turns the server markup of a live sample into one that takes edits. */
export function startSample(root: HTMLElement): void {
  const id = `live-${++samples}`;
  const fileList = query(root, '.live-files', HTMLElement);
  const statusLine = query(root, '[data-live-status]', HTMLElement);
  const code = query(root, '[data-live-code]', HTMLElement);
  const problemList = query(root, '[data-live-problems]', HTMLElement);
  const outputTabs = query(root, '.live-tabs', HTMLElement);
  const resultPanel = query(root, '[data-live-result]', HTMLElement);
  const compiledPanel = query(root, '[data-live-compiled]', HTMLElement);
  const frame = query(root, '[data-live-frame]', HTMLIFrameElement);
  const copy = query(root, '[data-live-copy]', HTMLButtonElement);
  const replLink = root.querySelector<HTMLAnchorElement>('[data-live-repl]');
  const staticFrame = frame.src;

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
  let editing: 'none' | 'loading' | 'on' = 'none';
  let compiledFrom: 'none' | 'static' | 'runs' = 'none';

  // The textarea goes over the highlighted code of the file shown.
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
  input.setAttribute('aria-label', `Code of ${files[0].name}`);
  input.value = files[0].source;
  code.append(marks, input, hint);
  for (const source of sources) {
    source.setAttribute('aria-hidden', 'true');
  }
  root.classList.add('is-live');
  copy.dataset.copy = files[0].source;

  // The output panels get ids, so each tab names the panel it controls.
  for (const tab of outputTabs.querySelectorAll<HTMLElement>('[data-live-tab]')) {
    const panel = tab.dataset.liveTab === 'compiled' ? compiledPanel : resultPanel;
    panel.id = `${id}-${tab.dataset.liveTab}`;
    tab.id = `${panel.id}-tab`;
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', tab.id);
  }

  const errorBox = document.createElement('div');
  errorBox.className = 'live-error';
  errorBox.hidden = true;
  resultPanel.append(errorBox);

  function setStatus(next: Status): void {
    root.dataset.status = next.kind;
    switch (next.kind) {
      case 'ready': {
        statusLine.textContent = '';
        break;
      }
      case 'loading': {
        statusLine.innerHTML = '<span class="live-spinner" aria-hidden="true"></span>Loading';
        break;
      }
      case 'running': {
        statusLine.innerHTML = '<span class="live-spinner" aria-hidden="true"></span>Running';
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

  /** Shows a file: its highlighted code before the editor loads, and its text in the textarea. */
  function showFile(index: number): void {
    active = index;
    selectTab(fileList, fileList.querySelectorAll<HTMLElement>('[role="tab"]')[index]);
    copy.dataset.copy = files[index].source;
    if (editing === 'on') {
      return;
    }
    for (const [at, source] of sources.entries()) {
      source.classList.toggle('is-shown', at === index);
    }
    input.value = files[index].source;
    input.setAttribute('aria-label', `Code of ${files[index].name}`);
  }

  const view: SampleView = {
    root,
    code,
    input,
    fileList,
    problemList,
    compiledPanel,
    frame,
    copy,
    files,
    original,
    active: () => active,
    styles: `<link rel="stylesheet" href="${new URL('../frame.css', staticFrame).href}">`,
    setStatus,
    showError,
    clearErrors,
    markCompiled: () => {
      compiledFrom = 'runs';
    },
  };

  /** Loads the session and gives it the sample. A failed load is tried again on the next key. */
  function startEditing(): void {
    if (editing !== 'none') {
      return;
    }
    editing = 'loading';
    setStatus({ kind: 'loading' });
    loadSession().then(
      (module) => {
        editing = 'on';
        module.attachSession(view);
      },
      () => {
        editing = 'none';
        setStatus({ kind: 'failed', message: LOAD_FAILED });
        clearErrors();
        showError(LOAD_FAILED);
      },
    );
  }

  // Before the editor loads, a key shows as plain text, so typing never waits on the network.
  input.addEventListener('input', () => {
    if (editing === 'on') {
      return;
    }
    files[active].source = input.value;
    copy.dataset.copy = input.value;
    sources[active].textContent = `${input.value}\n`;
    startEditing();
  });
  input.addEventListener('focusin', startEditing);
  // Hover starts the download, so the editor is often ready by the time of the first key.
  code.addEventListener(
    'pointerenter',
    () => {
      loadSession().catch(() => undefined);
    },
    { once: true },
  );

  /** The REPL link opens the code as the editor shows it. */
  function updateLink(): void {
    if (replLink === null) {
      return;
    }
    if (files.length === 1 && isSameFiles(files, original)) {
      return;
    }
    import('../repl/files.ts').then(
      (module) => {
        const url = new URL(replLink.href);
        url.hash = module.encodeFiles(files);
        replLink.href = url.href;
      },
      () => undefined,
    );
  }
  replLink?.addEventListener('pointerenter', updateLink);
  replLink?.addEventListener('focus', updateLink);

  // The theme message also asks the frame for its height, which it may have reported before
  // this script ran.
  frame.addEventListener('load', () => {
    syncTheme(frame);
  });
  if (frame.contentWindow !== null && frame.contentWindow.location.href !== 'about:blank') {
    syncTheme(frame);
  }

  window.addEventListener('message', (event) => {
    const data: unknown = event.data;
    // The static frame has the site's origin. The frame of an edit has none, so `null`.
    const known = event.origin === location.origin || event.origin === 'null';
    if (
      !known ||
      event.source !== frame.contentWindow ||
      typeof data !== 'object' ||
      data === null
    ) {
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

  function isShowingStatic(): boolean {
    return compiledFrom === 'static';
  }

  /** The Compiled tab of the code as the page shipped it, which the site build wrote. */
  async function loadCompiled(): Promise<void> {
    if (compiledFrom !== 'none') {
      return;
    }
    compiledFrom = 'static';
    compiledPanel.innerHTML = '<p class="live-empty">Loading</p>';
    let html: string | undefined;
    try {
      const response = await fetch(new URL('compiled.html', staticFrame));
      html = response.ok ? await response.text() : undefined;
    } catch {
      html = undefined;
    }
    // A run may have filled the tab meanwhile.
    if (!isShowingStatic()) {
      return;
    }
    if (html === undefined) {
      // The next time the tab opens, it tries again.
      compiledFrom = 'none';
      html = '<p class="live-empty">Could not load. Open the tab again.</p>';
    }
    compiledPanel.innerHTML = html;
  }

  for (const [index, tab] of fileList.querySelectorAll<HTMLElement>('[role="tab"]').entries()) {
    tab.addEventListener('click', () => {
      showFile(index);
      view.onFile?.(index);
    });
  }
  for (const tab of outputTabs.querySelectorAll<HTMLElement>('[data-live-tab]')) {
    tab.addEventListener('click', () => {
      selectTab(outputTabs, tab);
      const compiled = tab.dataset.liveTab === 'compiled';
      resultPanel.hidden = compiled;
      compiledPanel.hidden = !compiled;
      if (compiled) {
        loadCompiled().catch(() => undefined);
      }
    });
  }
  for (const list of [fileList, outputTabs]) {
    list.addEventListener('keydown', (event) => {
      moveFocus(list, event);
    });
  }

  showFile(0);
  setStatus({ kind: 'ready' });
}
