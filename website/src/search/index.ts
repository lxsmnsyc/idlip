// Builds the search index at build time: one entry per heading, and one for the page itself with
// the text before its first heading. Only the build reads this file.
import type { Page } from '../site.ts';
import type { Entry } from './entry.ts';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** The text of an HTML fragment: no code blocks (inline code stays), no tags, no copy buttons, language labels or REPL links, one space between words. */
export function htmlToText(html: string): string {
  return html
    .replaceAll(/<pre\b[\s\S]*?<\/pre>/g, ' ')
    .replaceAll(/<button\b[^>]*>[\s\S]*?<\/button>/g, ' ')
    .replaceAll(/<span class="code-lang">[\s\S]*?<\/span>/g, ' ')
    .replaceAll(/<a class="(?:anchor|code-repl)"[^>]*>[\s\S]*?<\/a>/g, ' ')
    .replaceAll(/<\/(?:p|li|pre|tr|td|th|h[1-6]|div|ul|ol|table)>|<br\s*\/?>/g, ' ')
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/** The entries of a page, in document order. */
function buildPageEntries(page: Page): Entry[] {
  const entries: Entry[] = [];
  let heading = '';
  let id = '';
  let from = 0;
  const push = (to: number): void => {
    entries.push({
      page: page.url,
      pageTitle: page.title,
      heading,
      id,
      text: htmlToText(page.html.slice(from, to)),
    });
  };
  for (const match of page.html.matchAll(/<h[1-6] id="([^"]*)">([\s\S]*?)<\/h[1-6]>/g)) {
    push(match.index);
    heading = htmlToText(match[2]);
    id = match[1];
    from = match.index + match[0].length;
  }
  push(page.html.length);
  return entries;
}

/** The entries of every page, in the order of the pages given. */
export function buildSearchIndex(pages: readonly Page[]): Entry[] {
  const entries: Entry[] = [];
  for (const page of pages) {
    entries.push(...buildPageEntries(page));
  }
  return entries;
}
