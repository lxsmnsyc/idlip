// The document of a frame that runs a project: the REPL frame, the frame of a live sample after an
// edit, and the static frame the site build writes for each live sample. Runs in Node and in the
// browser.
import { renderListener } from 'idlip/server';
import type { Rendered } from './render.ts';

/**
 * Reports the height of the frame's body to the page whenever it changes, so a live sample can
 * size its frame to the content. The body has no min height, so the report cannot grow the frame
 * by itself.
 */
const HEIGHT_REPORT = `addEventListener('DOMContentLoaded',function(){new ResizeObserver(function(){parent.postMessage({idlipHeight:Math.ceil(document.body.getBoundingClientRect().height)},'*')}).observe(document.body)})`;

/**
 * Reports the errors of the frame to the page: errors, rejections, `console.error` (the loader
 * logs a failed update there) and scripts that fail to load.
 */
function writeBridge(run: number): string {
  return `(function(){var s=function(m){parent.postMessage({idlipRepl:${run},message:String(m&&m.message||m)},'*')};addEventListener('error',function(e){s(e.target!==window&&e.target.src?'Could not load '+e.target.src:e.error||e.message)},true);addEventListener('unhandledrejection',function(e){s(e.reason)});var c=console.error;console.error=function(){c.apply(console,arguments);s(arguments[0])};${HEIGHT_REPORT}})()`;
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

export function writeFrameDocument(frame: FrameDocument): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Run ${frame.run}</title>${frame.styles}<script>${writeBridge(frame.run)}</script>${renderListener()}<script type="module" src="${frame.runtime}"></script>${frame.rendered.head}</head><body>${frame.rendered.body}</body></html>`;
}
