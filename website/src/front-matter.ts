/**
 * The front matter of a page: lines of `key: value` between two `---` lines at the top of the
 * file. A value in double quotes is read as JSON, any other value is the text of the line.
 */
export interface FrontMatter {
  /** The page title, shown as the `h1`, in the sidebar and in the tab. */
  title: string;
  /** The place of the page in its section. Lower comes first. */
  order: number;
  /** The sidebar group of the page. */
  section: string;
  /** The text for link previews. Without it the first paragraph is used. */
  description?: string;
}

/** The text of a value in double quotes. */
function parseQuoted(value: string): string {
  const parsed: unknown = JSON.parse(value);
  return typeof parsed === 'string' ? parsed : value;
}

/** Splits the front matter off a source and checks the three required fields. */
export function splitFrontMatter(
  source: string,
  file: string,
): { data: FrontMatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) {
    throw new Error(`${file}: the page has no front matter (title, order, section)`);
  }
  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (pair) {
      const value = pair[2].trim();
      fields.set(pair[1], value.startsWith('"') ? parseQuoted(value) : value);
    }
  }
  const title = fields.get('title');
  const section = fields.get('section');
  const order = Number(fields.get('order'));
  if (!title || !section || fields.get('order') === undefined || Number.isNaN(order)) {
    throw new Error(`${file}: the front matter needs a title, a numeric order and a section`);
  }
  const data: FrontMatter = { title, order, section };
  const description = fields.get('description');
  if (description) {
    data.description = description;
  }
  return { data, body: source.slice(match[0].length) };
}
