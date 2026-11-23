// The server markup of a live sample. It works with no script: the highlighted code of each file
// with its name. The stylesheet hides the tabs, the copy button and the output without script. The
// script in `sample.ts` turns the code into an editor and fills the output.
import type { ReplFile } from '../repl/files.ts';
import { escapeHtml, getLanguage, highlight } from '../repl/highlight.ts';
import REPL_ICON from '../repl/icons.ts';

export interface LiveOptions {
  /**
   * The address that opens the sample in the REPL. No REPL button without it. A sample of
   * several files links to `/repl/`, and the page adds the files to the hash on hover or focus.
   */
  repl?: string;
  /** The address of the static frame the site build writes for the sample. */
  frame?: string;
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replaceAll('"', '&quot;');
}

/**
 * The highlighted code of a file, as the editor paints it. The trailing newline keeps the last
 * line as tall as the textarea's, so `textContent` is the source plus one newline.
 */
export function renderSource(file: ReplFile): string {
  return `${highlight(file.source, getLanguage(file.name))}\n`;
}

export function renderLiveSample(files: readonly ReplFile[], options: LiveOptions = {}): string {
  // A tab per file. The first file is the page the sample renders.
  let tabs = '';
  let sources = '';
  for (const [index, file] of files.entries()) {
    const name = escapeAttribute(file.name);
    const selected = index === 0;
    tabs += `<button class="live-file" type="button" role="tab" aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-live-file="${name}">${escapeHtml(file.name)}</button>`;
    sources += `<pre class="live-layer live-highlight" data-live-source="${name}">${renderSource(file)}</pre>`;
  }

  const repl =
    options.repl === undefined
      ? ''
      : `<a class="icon-button live-repl" href="${escapeAttribute(options.repl)}" data-live-repl aria-label="Open this code in the REPL" title="Open this code in the REPL">${REPL_ICON.external}</a>`;

  const title = escapeAttribute(`Result of ${files[0]?.name ?? ''}`);
  const frame =
    options.frame === undefined
      ? ''
      : `<iframe class="live-frame" src="${escapeAttribute(options.frame)}" title="${title}" loading="lazy" data-live-frame></iframe>`;

  return `<figure class="live" data-live-sample aria-label="Live sample ${escapeAttribute(files[0]?.name ?? '')}">
<div class="live-bar"><div class="live-files" role="tablist" aria-label="Files">${tabs}</div><p class="live-status" data-live-status role="status"></p>${repl}<button class="code-copy" type="button" aria-label="Copy the code" data-live-copy>Copy</button></div>
<div class="live-code" data-live-code>${sources}</div>
<ul class="live-problems" data-live-problems hidden></ul>
<div class="live-output"><div class="live-tabs" role="tablist" aria-label="Output"><button class="live-tab" type="button" role="tab" aria-selected="true" data-live-tab="result">Result</button><button class="live-tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-live-tab="compiled">Compiled</button></div><div class="live-result" role="tabpanel" data-live-result>${frame}</div><div class="live-compiled" role="tabpanel" data-live-compiled hidden></div></div>
</figure>
`;
}
