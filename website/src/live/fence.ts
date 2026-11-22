// Reads the live samples of a page from its Markdown tokens. A fence such as ```` ```tsx live ````
// is a live sample. A fence right after it with a file name, such as
// ```` ```tsx live counter.tsx ```` or ```` ```json live props.json ````, is another file of the
// same sample. The site build, the sample check and the tests run this file in Node.
import { PROPS_FILE, isModuleName } from '../repl/files.ts';
import type { ReplFile } from '../repl/files.ts';

/** The fields of a Markdown token that this file reads. */
export interface FenceToken {
  type: string;
  info: string;
  content: string;
  map: [number, number] | null;
}

/** The live tag of a fence: its language and the file name it gives, if any. */
export interface LiveInfo {
  lang: 'tsx' | 'json';
  name: string | undefined;
}

export interface LiveSample {
  files: ReplFile[];
  /** The line of the first fence, from 1. */
  line: number;
  /** The index of the first and the last fence token in the token list. */
  first: number;
  last: number;
}

/** The live tag of a fence info string, or `undefined` when the fence is not live. */
export function parseLiveInfo(info: string): LiveInfo | undefined {
  const [lang = '', tag = '', name, ...rest] = info.trim().split(/\s+/);
  if (tag !== 'live' || rest.length > 0 || (lang !== 'tsx' && lang !== 'json')) {
    return undefined;
  }
  return { lang, name };
}

/** `TodoApp` becomes `todo-app.tsx`. */
function getFileName(component: string): string {
  return `${component.replaceAll(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase()}.tsx`;
}

/** The name of a first file with no name: from its default export, or `app.tsx`. */
export function nameEntry(source: string): string {
  const component = /export\s+default\s+function\s+([A-Z]\w*)/.exec(source)?.[1];
  return component === undefined ? 'app.tsx' : getFileName(component);
}

/** Says what is wrong with the file name of a live fence, or returns an empty string. */
function checkName(info: LiveInfo, name: string): string {
  if (info.lang === 'json') {
    return name === PROPS_FILE ? '' : `A json live fence is the props file. Name it ${PROPS_FILE}.`;
  }
  return isModuleName(name)
    ? ''
    : `${name} is not a file name a live sample runs, such as part.tsx.`;
}

/**
 * Groups the live fences of a token list into samples. A fence with no name starts a sample. A
 * fence with a name joins the sample of the fence right before it, or starts one. Throws on a
 * file name the REPL does not run, a duplicate name, or a sample that does not start with a
 * `.tsx` file.
 */
export function findLiveSamples(tokens: readonly FenceToken[], file = 'page'): LiveSample[] {
  const samples: LiveSample[] = [];
  let open: LiveSample | undefined;
  for (const [index, token] of tokens.entries()) {
    const info = token.type === 'fence' ? parseLiveInfo(token.info) : undefined;
    if (info === undefined) {
      open = undefined;
      continue;
    }
    const line = (token.map?.[0] ?? 0) + 1;

    // A named fence right after a sample is one more file of it.
    if (info.name !== undefined && open?.last === index - 1) {
      const problem = checkName(info, info.name);
      if (problem !== '') {
        throw new Error(`${file}:${line}: ${problem}`);
      }
      for (const known of open.files) {
        if (known.name === info.name) {
          throw new Error(`${file}:${line}: the sample has two files named ${info.name}.`);
        }
      }
      open.files.push({ name: info.name, source: token.content });
      open.last = index;
      continue;
    }

    // Otherwise the fence starts a sample, and its file is the page the sample renders.
    if (info.lang !== 'tsx') {
      throw new Error(`${file}:${line}: a live sample starts with a tsx fence.`);
    }
    const name = info.name ?? nameEntry(token.content);
    const problem = checkName(info, name);
    if (problem !== '') {
      throw new Error(`${file}:${line}: ${problem}`);
    }
    open = { files: [{ name, source: token.content }], line, first: index, last: index };
    samples.push(open);
  }
  return samples;
}
