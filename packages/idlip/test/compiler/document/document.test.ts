import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';

function rules(source: string): string[] {
  return compile(source, '/src/app.tsx').diagnostics.map((d) => d.rule);
}

function getReturn(server: string): string {
  const line = server.split('\n').find((text) => text.startsWith('return `'));
  return line ?? '';
}

describe('document component', () => {
  it('compiles a static document and marks the manifest', () => {
    const result = compile(
      `export default function App(props: { n: number }) {
  let n = props.n;
  function up() { n = n + 1; }
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>todo</title>
      </head>
      <body class="x">
        <button on:click={up}>{n}</button>
      </body>
    </html>
  );
}`,
      '/src/app.tsx',
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.manifest.document).toBe(true);
    // The head has no hole, so it stays markup in `<head>` and the loader needs no head block.
    expect(result.manifest.head).toBeUndefined();
    const html = getReturn(result.server);
    expect(html).toContain(
      '<html lang="en"><head><meta charset="utf-8"><title>todo</title></head>',
    );
    expect(html).toContain('<body class="x">');
  });

  it('writes a bound attribute on html and body', () => {
    const result = compile(
      `export default function App() {
  let lang = 'en';
  function go() { lang = 'fr'; }
  return (
    <html lang={lang}>
      <head></head>
      <body class={lang === 'en' ? 'a' : 'b'}>
        <button on:click={go}>x</button>
      </body>
    </html>
  );
}`,
      '/src/app.tsx',
    );
    expect(result.diagnostics).toEqual([]);
    const html = getReturn(result.server);
    expect(html).toContain("attr$('lang', lang)");
    expect(html).toContain('<body');
    expect(result.manifest.document).toBe(true);
  });

  it('makes a head with a hole the first Head block', () => {
    const result = compile(
      `export default function App() {
  let n = 1;
  const title = 'Items ' + n;
  function up() { n = n + 1; }
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>{title}</title>
      </head>
      <body>
        <button on:click={up}>{n}</button>
      </body>
    </html>
  );
}`,
      '/src/app.tsx',
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.manifest.head).toBe(true);
    expect(result.manifest.document).toBe(true);
    const html = getReturn(result.server);
    expect(html).toContain('<head></head><body>');
    expect(html).toContain('<template i-head=');
  });

  it('does not mark a component that is not a document', () => {
    const result = compile(
      `export default function App() { return <main>a</main>; }`,
      '/src/app.tsx',
    );
    expect(result.manifest.document).toBeUndefined();
  });

  it('rejects the skeleton elements outside the root of the view', () => {
    expect(
      rules(`export default function App() {
  let a = false;
  function f() { a = !a; }
  return <main><button on:click={f}>x</button>{a && <html><head></head><body>b</body></html>}</main>;
}`),
    ).toContain('document-element-misplaced');
    expect(rules(`export default function App() { return <div><body>b</body></div>; }`)).toContain(
      'document-element-misplaced',
    );
    expect(
      rules(`export default function App() { return <head><meta charset="utf-8" /></head>; }`),
    ).toContain('document-element-misplaced');
  });

  it('rejects an html that does not have one head and one body', () => {
    expect(
      rules(`export default function App() { return <html><body>b</body></html>; }`),
    ).toContain('document-element-misplaced');
    expect(
      rules(
        `export default function App() { return <html><head></head><body>b</body><body>c</body></html>; }`,
      ),
    ).toContain('document-element-misplaced');
  });

  it('rejects events, ref and html on the skeleton, and attributes on head', () => {
    expect(
      rules(`export default function App() {
  let n = 0;
  function f() { n = n + 1; }
  return <html on:click={f}><head></head><body>{n}</body></html>;
}`),
    ).toContain('document-element-misplaced');
    expect(
      rules(`export default function App() {
  return <html><head class="x"></head><body>b</body></html>;
}`),
    ).toContain('document-element-misplaced');
  });

  it('rejects text and a second title in the document head', () => {
    expect(
      rules(`export default function App() {
  return <html><head>text</head><body>b</body></html>;
}`),
    ).toContain('document-head-content');
    expect(
      rules(`export default function App() {
  return <html><head><title>a</title><title>b</title></head><body>b</body></html>;
}`),
    ).toContain('head-title-twice');
  });

  it('rejects an event on an element of the document head', () => {
    expect(
      rules(`export default function App() {
  let n = 0;
  function f() { n = n + 1; }
  return <html><head><meta charset="utf-8" on:click={f} /></head><body>{n}</body></html>;
}`),
    ).toContain('codegen-unsupported');
  });

  it('rejects a script in the document head, inline or with a src, and keeps a style', () => {
    for (const script of ['<script>x</script>', '<script src="/a.js"></script>']) {
      expect(
        rules(`export default function App() {
  return <html><head>${script}</head><body>b</body></html>;
}`),
      ).toContain('document-head-script');
    }
    expect(
      rules(`export default function App() {
  return <html><head><style>a</style></head><body>b</body></html>;
}`),
    ).toEqual([]);
  });

  it('still rejects a title outside the document head', () => {
    expect(
      rules(`export default function App() {
  return <html><head></head><body><title>x</title></body></html>;
}`),
    ).toContain('title-outside-head');
  });

  it('rejects a document rendered by a component that another one renders', () => {
    expect(
      rules(`function Frame() { return <html><head></head><body>b</body></html>; }
export default function App() { return <main><Frame /></main>; }`),
    ).toContain('document-element-misplaced');
  });
});
