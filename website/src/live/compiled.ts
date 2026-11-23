// The Compiled tab of a live sample: the server module and each client chunk, with its gzip size.
// The site build writes it for the code as the page ships it, and the page writes it again after
// an edit. It takes code that is already highlighted, so it pulls in no highlighter.
import { HELPERS_PATH, listFileChunks } from '../repl/chunks.ts';
import type { ServedChunk } from '../repl/chunks.ts';
import REPL_ICON from '../repl/icons.ts';
import type { Project } from '../repl/project.ts';

/** A module of the tab, before its size and its highlighted code are known. */
export interface CompiledModule {
  title: string;
  /** When the module runs: on the server, on its event, or when its value changes. */
  note: string;
  code: string;
}

export interface CompiledRow {
  title: string;
  note: string;
  /** Bytes in gzip. */
  size: number;
  /** The highlighted code. */
  html: string;
}

/** When a client chunk loads, by its name. */
function describeChunk(chunk: string): string {
  if (chunk.includes('handler=')) {
    return 'loads on its event';
  }
  // A child's view chunk renders a new child that the parent adds in the browser.
  return chunk === 'view' || chunk.endsWith('.view')
    ? 'loads for a new child'
    : 'loads when its value changes';
}

/** The modules of a project, named as the run serves them. */
export function listCompiledModules(
  project: Project,
  chunks: readonly ServedChunk[],
): CompiledModule[] {
  const paths = new Map<string, string>();
  for (const chunk of chunks) {
    paths.set(`${chunk.file}\0${chunk.chunk}`, chunk.path);
  }
  const modules: CompiledModule[] = [];
  for (const file of project.files) {
    if (file.result.server !== '') {
      modules.push({
        title: `${file.name}, server`,
        note: 'renders the HTML',
        code: file.result.server,
      });
    }
    for (const chunk of listFileChunks(file)) {
      modules.push({
        title: paths.get(`${file.name}\0${chunk.chunk}`) ?? `${file.name} ${chunk.chunk}`,
        note: describeChunk(chunk.chunk),
        code: chunk.code,
      });
    }
  }
  // The REPL serves every helper. A build keeps only the ones the chunks use.
  modules.push({
    title: HELPERS_PATH,
    note: 'helpers the chunks share, loads with the first chunk',
    code: project.helpers,
  });
  return modules;
}

/** Kept here: `highlight.ts` has one too, but it loads the grammars. */
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function formatBytes(bytes: number): string {
  return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;
}

/** The markup of the tab. Each row opens to show its code. */
export function renderCompiled(rows: readonly CompiledRow[]): string {
  if (rows.length === 0) {
    return '<p class="live-empty">Nothing compiled.</p>';
  }
  let html = '<p class="live-compiled-head"><span>Module</span><span>gzip</span></p>';
  for (const row of rows) {
    html += `<details class="live-module"><summary>${REPL_ICON.chevron}<span class="live-module-name">${escapeHtml(row.title)}</span><span class="live-module-note">${escapeHtml(row.note)}</span><span class="live-module-size">${formatBytes(row.size)}</span></summary><pre class="live-module-code" tabindex="0">${row.html}</pre></details>`;
  }
  return html;
}
