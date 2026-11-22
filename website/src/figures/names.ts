// The names a ` ```figure <name> ` fence can take. This file imports nothing, so the Markdown
// renderer can check a name without loading the figures, which import the layout.

export const FIGURE_NAMES = ['mvu-loop', 'message-trace'] as const;

export type FigureName = (typeof FIGURE_NAMES)[number];

export function isFigureName(name: string): name is FigureName {
  for (const known of FIGURE_NAMES) {
    if (known === name) {
      return true;
    }
  }
  return false;
}
