// Element nestings the HTML parser rewrites. Ported from ../brumate/packages/brumate/src/nesting.ts
// (rule BRM185 there). The rules are the "in body" and "in table" insertion modes of the HTML
// spec that hold in every standards-mode document.

const CLOSES_P = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'center',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dd',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'li',
  'listing',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'search',
  'section',
  'summary',
  'ul',
  'xmp',
]);

const BUTTON_SCOPE = new Set([
  'applet',
  'button',
  'caption',
  'html',
  'marquee',
  'object',
  'table',
  'td',
  'template',
  'th',
]);

const LINK_MARKERS = new Set(['applet', 'caption', 'marquee', 'object', 'template', 'td', 'th']);

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const SECTION_CHILDREN = new Set([
  'form',
  'input',
  'script',
  'style',
  'td',
  'template',
  'th',
  'tr',
]);

const TABLE_CHILDREN: Record<string, ReadonlySet<string> | undefined> = {
  table: new Set([...SECTION_CHILDREN, 'caption', 'col', 'colgroup', 'tbody', 'tfoot', 'thead']),
  tbody: SECTION_CHILDREN,
  thead: SECTION_CHILDREN,
  tfoot: SECTION_CHILDREN,
  tr: new Set(['form', 'input', 'script', 'style', 'td', 'template', 'th']),
};

function isParagraphOpen(open: readonly string[]): boolean {
  for (let index = open.length - 1; index >= 0; index--) {
    if (open[index] === 'p') {
      return true;
    }
    if (BUTTON_SCOPE.has(open[index])) {
      return false;
    }
  }
  return false;
}

function findOpen(open: readonly string[], tag: string, stop: ReadonlySet<string>): boolean {
  for (let index = open.length - 1; index >= 0; index--) {
    if (open[index] === tag) {
      return true;
    }
    if (stop.has(open[index])) {
      return false;
    }
  }
  return false;
}

/**
 * Returns the open tag that the HTML parser closes or moves `tag` out of, or undefined.
 * `open` lists the tags above the element, nearest last.
 */
export function findNestingProblem(open: readonly string[], tag: string): string | undefined {
  // Foreign content follows other rules.
  if (open.includes('svg') || open.includes('math')) {
    return undefined;
  }
  const parent = open.at(-1);
  if (CLOSES_P.has(tag) && isParagraphOpen(open)) {
    return 'p';
  }
  if (parent !== undefined) {
    if (HEADINGS.has(parent) && HEADINGS.has(tag)) {
      return parent;
    }
    if (parent === 'li' && tag === 'li') {
      return parent;
    }
    if ((parent === 'dd' || parent === 'dt') && (tag === 'dd' || tag === 'dt')) {
      return parent;
    }
    const allowed = TABLE_CHILDREN[parent];
    if (allowed !== undefined && !allowed.has(tag)) {
      return parent;
    }
  }
  if (tag === 'a' && findOpen(open, 'a', LINK_MARKERS)) {
    return 'a';
  }
  if (tag === 'form' && findOpen(open, 'form', new Set(['template']))) {
    return 'form';
  }
  if (tag === 'button' && findOpen(open, 'button', BUTTON_SCOPE)) {
    return 'button';
  }
  return undefined;
}

/**
 * Returns the elements the HTML parser inserts between `parent` and `tag`, or undefined.
 * `<table><tr>` parses as `<table><tbody><tr>`, so a template walked by child index would
 * miss a node.
 */
export function findImpliedWrapper(parent: string | undefined, tag: string): string | undefined {
  if (parent === 'table' && tag === 'tr') {
    return '<tbody>';
  }
  if (parent === 'table' && (tag === 'td' || tag === 'th')) {
    return '<tbody> and <tr>';
  }
  if (
    (parent === 'tbody' || parent === 'thead' || parent === 'tfoot') &&
    (tag === 'td' || tag === 'th')
  ) {
    return '<tr>';
  }
  if (parent === 'table' && tag === 'col') {
    return '<colgroup>';
  }
  return undefined;
}
