// oxlint-disable import/prefer-default-export
// The shell of `/repl/`. The site script sees `[data-repl]` and loads the REPL code, so no other
// page loads it. The frame styles go in a template: the frame that runs the code uses them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ICON, renderFooter, renderHead, renderHeader } from '../layout.ts';
import REPL_ICON from './icons.ts';

const STYLES = fileURLToPath(new URL('../styles.css', import.meta.url));
const DEMO_FRAME = fileURLToPath(new URL('../demo/frame.css', import.meta.url));
const REPL_FRAME = fileURLToPath(new URL('frame.css', import.meta.url));
const REPL_STYLES = fileURLToPath(new URL('repl.css', import.meta.url));

/** The tokens of the site, between the markers in `styles.css`. */
function readTokens(): string {
  const css = readFileSync(STYLES, 'utf8');
  const start = css.indexOf('/* tokens:start */');
  const end = css.indexOf('/* tokens:end */');
  if (start === -1 || end === -1) {
    throw new Error(`${STYLES} has no tokens:start and tokens:end markers`);
  }
  return css.slice(start, end);
}

function minify(css: string, base: string): string {
  return css
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll('url(/fonts/', `url(${base}fonts/`)
    .replaceAll(/\s*\n\s*/g, ' ')
    .trim();
}

/** The styles of the frame: the site tokens, the demo frame and the extra elements of the examples. */
function readFrameStyles(base: string): string {
  return minify(
    `${readTokens()}\n${readFileSync(DEMO_FRAME, 'utf8')}\n${readFileSync(REPL_FRAME, 'utf8')}`,
    base,
  );
}

function renderTab(id: string, label: string, selected: boolean, extra = ''): string {
  return `<button class="repl-tab" type="button" role="tab" id="repl-tab-${id}" aria-controls="repl-panel-${id}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-repl-tab="${id}">${label}${extra}</button>`;
}

function renderPanel(id: string, body: string, hidden = true): string {
  return `<div class="repl-panel" role="tabpanel" id="repl-panel-${id}" aria-labelledby="repl-tab-${id}" tabindex="0"${hidden ? ' hidden' : ''}>${body}</div>`;
}

/** The `/repl/` page. */
export function renderRepl({ base, start }: { base: string; start: string }): string {
  const header = renderHeader(base, start, 'REPL');
  const network = `<div class="demo-net repl-net" data-net>
      <h2 class="net-head">Network</h2>
      <p class="net-group">On load</p>
      <ul class="net-list" data-net-load><li class="net-empty">Nothing ran yet</li></ul>
      <p class="net-group">On your events</p>
      <ul class="net-list net-click" data-net-events><li class="net-empty">Nothing yet. Click in the page.</li></ul>
      <p class="net-total"><span>Component code on load</span><span data-net-code-load>0 B</span></p>
      <p class="net-total"><span>Component code on events</span><span data-net-code-events>0 B</span></p>
    </div>`;
  const result = `<div class="repl-state"><p class="repl-status" data-repl-status aria-live="polite">Loading the compiler</p><button class="repl-run-button" type="button" data-repl-run hidden>${REPL_ICON.play}Run</button></div>
    <div class="repl-error" data-repl-error role="alert" hidden></div>
    <div class="repl-run">
      <div class="demo-app repl-app">
        <div class="demo-bar"><span data-repl-address>Server render, then resume</span><button class="icon-button" type="button" data-repl-reload aria-label="Run again" title="Run again">${ICON.reload}</button></div>
        <iframe class="demo-frame repl-frame" title="The running page" data-repl-frame></iframe>
      </div>
      ${network}
    </div>`;
  return `<!doctype html>
<html lang="en">
${renderHead(base, 'REPL - idlip', 'Write an idlip component, see what it compiles to, and run it: server render, then resume.')}
<body>
<a class="skip" href="#content">Skip to the content</a>
${header}
<style>${minify(readFileSync(REPL_STYLES, 'utf8'), base)}</style>
<main id="content" class="repl" data-repl data-base="${base}">
  <div class="repl-top">
    <h1 class="repl-title">REPL</h1>
    <label class="repl-pick"><span>Example</span><select data-repl-example><option value="">Your files</option></select></label>
    <button class="repl-share" type="button" data-repl-share>${REPL_ICON.link}<span data-repl-share-label>Copy the link</span></button>
  </div>
  <section class="repl-editor" aria-label="Editor">
    <div class="repl-files">
      <div class="repl-file-tabs" role="tablist" aria-label="Files" data-repl-files></div>
      <button class="repl-undo" type="button" data-repl-undo hidden></button>
      <form class="repl-add" data-repl-add>
        <input name="name" aria-label="New file name" placeholder="name.tsx" pattern="[\\w.\\-]+" required>
        <button class="icon-button" type="submit" aria-label="Add the file" title="Add the file">${REPL_ICON.plus}</button>
      </form>
    </div>
    <div class="repl-code" data-repl-code>
      <pre class="repl-layer repl-highlight" aria-hidden="true" data-repl-highlight></pre>
      <pre class="repl-layer repl-marks" aria-hidden="true" data-repl-marks></pre>
      <textarea class="repl-layer repl-input" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Code" aria-describedby="repl-file-problems" data-repl-input></textarea>
    </div>
    <ul class="repl-file-problems" id="repl-file-problems" data-repl-file-problems></ul>
  </section>
  <section class="repl-output" aria-label="Output">
    <div class="repl-tabs" role="tablist" aria-label="Output">
      ${renderTab('result', 'Result', true)}${renderTab('js', 'JS', false)}${renderTab('state', 'State', false)}${renderTab('html', 'HTML', false)}${renderTab('problems', 'Problems', false, ' <span class="repl-count" data-repl-count>0</span>')}
    </div>
    ${renderPanel('result', result, false)}
    ${renderPanel('js', '<div data-repl-js></div>')}
    ${renderPanel('state', '<pre class="repl-out" data-repl-state></pre>')}
    ${renderPanel('html', '<pre class="repl-out" data-repl-html></pre>')}
    ${renderPanel('problems', '<ul class="repl-problems" data-repl-problems></ul>')}
  </section>
</main>
<template data-repl-frame-css>${readFrameStyles(base)}</template>
${renderFooter()}
</body>
</html>
`;
}
