// The document of a frame that runs a project. Two kinds:
//
// - The static frame the site build writes for each live sample. It runs only the site's own
//   build, so it loads its chunks over the network and stays on the site's origin.
// - The sandboxed frame of a run of reader code: the REPL frame and the frame of a live sample
//   after an edit. It has no origin, so it cannot read the page, its storage or its cookies.
//   It carries its chunks inside the document and serves them from blob URLs it makes itself.
//
// Both run in Node and in the browser.
import { renderListener } from 'idlip/server';
import type { Rendered } from './render.ts';

/**
 * Reports the height of the frame's body to the page whenever it changes, so a live sample can
 * size its frame to the content. The body has no min height, so the report cannot grow the frame
 * by itself. The page asks for a first report with a theme message, since a frame without an
 * origin cannot be measured from outside.
 */
const HEIGHT_REPORT = `var h=function(){if(document.body)send({idlipHeight:Math.ceil(document.body.getBoundingClientRect().height)})};addEventListener('DOMContentLoaded',function(){new ResizeObserver(h).observe(document.body)})`;

/**
 * Takes the theme the page shows. Only the page that holds the frame can send it. The page
 * cannot reach into a frame without an origin, so the theme travels by message.
 */
const THEME_LISTENER = `addEventListener('message',function(e){var d=e.data;if(e.source!==parent||!d||typeof d!=='object'||!('idlipTheme' in d))return;var r=document.documentElement;if(typeof d.idlipTheme==='string')r.dataset.theme=d.idlipTheme;else delete r.dataset.theme;h()})`;

/**
 * Reports the errors of the frame to the page: errors, rejections, `console.error` (the loader
 * logs a failed update there) and scripts that fail to load. `target` is the origin of the page,
 * or `*` for a static frame.
 */
function writeBridge(run: number, target: string): string {
  return `(function(){var send=function(m){parent.postMessage(m,${JSON.stringify(target)})};var s=function(m){send({idlipRepl:${run},message:String(m&&m.message||m)})};addEventListener('error',function(e){s(e.target!==window&&e.target.src?'Could not load '+e.target.src:e.error||e.message)},true);addEventListener('unhandledrejection',function(e){s(e.reason)});var c=console.error;console.error=function(){c.apply(console,arguments);s(arguments[0])};${HEIGHT_REPORT};${THEME_LISTENER}})()`;
}

export interface FrameDocument {
  rendered: Rendered;
  /** The markup that styles the frame: a `<style>` or a `<link>`. */
  styles: string;
  /** The URL of the loader module, `runtime.ts` as Vite built it. */
  runtime: string;
  /** The run number, for the title and the error messages. */
  run: number;
}

/** The document of a static frame, which loads its loader and chunks over the network. */
export function writeFrameDocument(frame: FrameDocument): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Run ${frame.run}</title>${frame.styles}<script>${writeBridge(frame.run, '*')}</script>${renderListener()}<script type="module" src="${frame.runtime}"></script>${frame.rendered.head}</head><body>${frame.rendered.body}</body></html>`;
}

/** A module of a sandboxed frame: its URL in the run folder, its code, and a name for the panel. A module without a name does not report. */
export interface FrameModule {
  url: string;
  name: string;
  code: string;
}

export interface SandboxDocument {
  rendered: Rendered;
  styles: string;
  /** The code of the loader module. */
  runtime: string;
  /** The client chunks and the helpers, which the frame serves to itself. */
  modules: readonly FrameModule[];
  run: number;
  /** The origin of the page that holds the frame. The frame sends its messages only there. */
  origin: string;
}

/**
 * Makes a blob URL for each module and tells the browser, with an import map, that the URL of
 * the run folder means that blob. So the loader's `import()` of a chunk URL reads the chunk
 * from the document, and each chunk tells the page when it runs. The loader module starts
 * after the page is parsed, as a `type="module"` script would.
 */
function writeBootstrap(origin: string): string {
  return `(function(){var data=JSON.parse(document.getElementById('idlip-run').textContent);var late=false;var send=function(m){parent.postMessage(m,${JSON.stringify(origin)})};addEventListener('pointerdown',function(){late=true},true);addEventListener('keydown',function(){late=true},true);globalThis.__idlipReport=function(name,size){send({idlipChunk:name,size:size,afterEvent:late})};var map={};for(var i=0;i<data.modules.length;i++){var m=data.modules[i];var code=(m.name?'globalThis.__idlipReport('+JSON.stringify(m.name)+','+m.size+');\\n':'')+m.code;map[m.url]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}))}var table=document.createElement('script');table.type='importmap';table.textContent=JSON.stringify({imports:map});document.head.append(table);addEventListener('DOMContentLoaded',function(){var s=document.createElement('script');s.type='module';s.src=URL.createObjectURL(new Blob([data.runtime],{type:'text/javascript'}));document.head.append(s)})})()`;
}

/** Escapes JSON for a `<script type="application/json">`: no `<` can end the script. */
function writeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

/** The document of a frame without an origin. Pass it as `srcdoc` of a sandboxed iframe. */
export function writeSandboxDocument(frame: SandboxDocument): string {
  const encoder = new TextEncoder();
  const modules: { url: string; name: string; code: string; size: number }[] = [];
  for (const module of frame.modules) {
    modules.push({ ...module, size: encoder.encode(module.code).byteLength });
  }
  const data = writeJson({ modules, runtime: frame.runtime });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Run ${frame.run}</title>${frame.styles}<script>${writeBridge(frame.run, frame.origin)}</script>${renderListener()}<script type="application/json" id="idlip-run">${data}</script><script>${writeBootstrap(frame.origin)}</script>${frame.rendered.head}</head><body>${frame.rendered.body}</body></html>`;
}
