// Highlights code in the REPL with the highlighter the docs use, so the colors are the same.
import { language as json } from '@twinkleplop/json';
import { language as tsx } from '@twinkleplop/tsx';
import { language as typescript } from '@twinkleplop/typescript';

const LANGUAGES = { tsx: tsx(), ts: typescript(), json: json() };

export type Language = keyof typeof LANGUAGES | 'plain';

export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** The highlighted lines of the code, without the `<pre>` and `<code>` around them. */
export function highlight(code: string, language: Language): string {
  if (language === 'plain') {
    return escapeHtml(code);
  }
  const html = LANGUAGES[language](code);
  const start = html.indexOf('<code>') + '<code>'.length;
  const end = html.lastIndexOf('</code>');
  return html.slice(start, end);
}

/** The language of a file of the REPL, by its name. */
export function getLanguage(name: string): Language {
  if (name.endsWith('.tsx')) {
    return 'tsx';
  }
  return name.endsWith('.json') ? 'json' : 'plain';
}
