// The animated figures of the docs. A ` ```figure <name> ` fence renders one of them at build
// time. `src/client/figures.ts` loads the player when a figure nears the viewport.
import type { DemoData } from '../demo/data.ts';
import { renderMessageTrace } from './message-trace.ts';
import { renderMvuLoop } from './mvu-loop.ts';
import type { FigureName } from './names.ts';

const FIGURES: Record<FigureName, (demo: DemoData) => string> = {
  'mvu-loop': renderMvuLoop,
  'message-trace': renderMessageTrace,
};

/** The markup of a figure, with the numbers of the demo build. */
export function renderFigure(name: FigureName, demo: DemoData): string {
  return FIGURES[name](demo);
}

/**
 * A page's HTML with each figure cut down to its caption, for the search index: the drawing is
 * names and sizes, not text to search.
 */
export function stripFigures(html: string): string {
  return html.replaceAll(
    /<figure class="fig\b[\s\S]*?<figcaption>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/g,
    '<p>$1</p>',
  );
}
