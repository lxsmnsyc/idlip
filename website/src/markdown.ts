import { language as bash } from '@twinkleplop/bash';
import { language as css } from '@twinkleplop/css';
import { language as json } from '@twinkleplop/json';
import twinkleplop from '@twinkleplop/markdown-it';
import { language as tsx } from '@twinkleplop/tsx';
import { language as typescript } from '@twinkleplop/typescript';
import MarkdownIt from 'markdown-it';

export interface Heading {
  level: number;
  text: string;
  id: string;
}

/** What rendering a page gives back besides the HTML. */
export interface RenderEnv {
  headings: Heading[];
  /** The text of the first paragraph, for the description. */
  lead: string;
  /** Turns a link target that ends in `.md` into a site path. */
  link: (href: string) => string;
}

// `tsx` and `ts` blocks use the stock grammars. A tag after the language (`no-check`, `fragment`)
// only matters to the sample checker.
const LANGUAGES = {
  tsx: tsx(),
  ts: typescript(),
  css: css(),
  bash: bash(),
  json: json(),
};

/** A heading id as GitHub makes it, so links between pages keep working. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replaceAll(/\s+/g, '-');
}

/** A Markdown renderer with highlighted code, anchored headings and site links. */
export function createRenderer(): MarkdownIt {
  const parser = new MarkdownIt({ html: false, linkify: false });
  parser.use(twinkleplop, { languages: LANGUAGES, on_unknown_language: 'plain' });
  const escape = parser.utils.escapeHtml;

  // A code block has a label with its language and a button that copies its text. A scrolling
  // block takes focus, so a keyboard user can scroll it.
  const fence = parser.renderer.rules.fence!;
  parser.renderer.rules.fence = (tokens, index, options, env, self) => {
    const language = tokens[index].info.trim().split(/\s+/)[0] ?? '';
    const pre = fence(tokens, index, options, env, self).replace(
      /<pre(?=[\s>])/,
      '<pre tabindex="0" role="group" aria-label="Code"',
    );
    const tag =
      language && language !== 'plain' ? `<span class="code-lang">${escape(language)}</span>` : '';
    return `<div class="code-block">${tag}<button class="code-copy" type="button" aria-label="Copy the code">Copy</button>${pre}</div>\n`;
  };
  parser.renderer.rules.table_open = () =>
    '<div class="table-scroll" role="group" aria-label="Table" tabindex="0">\n<table>\n';
  parser.renderer.rules.table_close = () => '</table>\n</div>\n';

  parser.renderer.rules.link_open = (tokens, index, options, env: RenderEnv, self) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    if (href) {
      if (/^https?:/.test(href)) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noreferrer');
      } else {
        token.attrSet('href', env.link(href));
      }
    }
    return self.renderToken(tokens, index, options);
  };

  parser.renderer.rules.heading_open = (tokens, index, options, env: RenderEnv, self) => {
    const token = tokens[index];
    const text = (tokens[index + 1]?.content ?? '').replaceAll('`', '');
    const id = slugify(text);
    token.attrSet('id', id);
    env.headings.push({ level: Number(token.tag.slice(1)), text, id });
    const anchor = `<a class="anchor" href="#${escape(id)}" aria-label="Link to this section">#</a>`;
    return `${self.renderToken(tokens, index, options)}${anchor}`;
  };

  // The first paragraph is the description of a page without one.
  parser.core.ruler.push('lead', (state) => {
    // markdown-it types the env as any; `loadPages` and `renderLanding` always pass a RenderEnv.
    // oxlint-disable-next-line typescript/no-unsafe-assignment
    const env: RenderEnv = state.env;
    for (const [index, token] of state.tokens.entries()) {
      if (token.type === 'paragraph_open' && env.lead === '') {
        env.lead = state.tokens[index + 1]?.content.replaceAll(/[`*_]/g, '') ?? '';
      }
    }
  });
  return parser;
}
