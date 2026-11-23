// oxlint-disable no-console
// Draws `public/og.png`, the share image (1200 x 630). The headline and the lead are read from
// the landing page source, the colors from the tokens of `src/styles.css`, and the fonts from
// `public/fonts/`, so the image follows the site. Run it after the hero text changes:
//
//   node scripts/og.ts
//
// It renders an HTML page with headless Chromium from the Playwright of the `e2e` package, so
// run `pnpm install` first and, if Chromium is missing, `pnpm --filter e2e exec playwright
// install chromium`.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STYLES = `${ROOT}src/styles.css`;
const LANDING = `${ROOT}src/landing/index.ts`;
const OUTPUT = `${ROOT}public/og.png`;
const ICON = `${ROOT}public/icon.svg`;

const WIDTH = 1200;
const HEIGHT = 630;

interface Screenshotter {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  setContent(html: string, options: { waitUntil: 'load' }): Promise<void>;
  evaluate(script: string): Promise<unknown>;
  screenshot(options: { path: string }): Promise<unknown>;
}

interface Chromium {
  launch(): Promise<{ newPage(): Promise<Screenshotter>; close(): Promise<void> }>;
}

function isChromium(value: unknown): value is Chromium {
  return typeof value === 'object' && value !== null && 'launch' in value;
}

/** Playwright comes from the `e2e` package, so the website needs no browser dependency. */
function loadChromium(): Chromium {
  const require = createRequire(new URL('../../e2e/package.json', import.meta.url));
  const loaded: unknown = require('@playwright/test');
  // The package exports the `test` function, which carries `chromium` as a property.
  const chromium: unknown =
    (typeof loaded === 'object' || typeof loaded === 'function') && loaded !== null
      ? Reflect.get(loaded, 'chromium')
      : undefined;
  if (!isChromium(chromium)) {
    throw new TypeError('@playwright/test of the e2e package has no chromium');
  }
  return chromium;
}

/** The tokens of the site, between the markers in `styles.css`. */
function readTokens(): string {
  const css = readFileSync(STYLES, 'utf8');
  const start = css.indexOf('/* tokens:start */');
  const end = css.indexOf('/* tokens:end */');
  if (start === -1 || end === -1) {
    throw new Error(`${STYLES} has no tokens:start and tokens:end markers`);
  }
  return css.slice(start, end);
}

interface Copy {
  /** The hero headline, with `<em>` around the word that changes. */
  headline: string;
  /** The first sentence of the hero lead. */
  lead: string;
}

/** Reads the hero text from the landing page source, and fails when the markup moved. */
function readCopy(): Copy {
  const source = readFileSync(LANDING, 'utf8');
  const headline = /<h1 class="display">([^<]*(?:<em>[^<]*<\/em>[^<]*)*)<\/h1>/.exec(source)?.[1];
  const lead = /<p class="lead">([^<]*)<\/p>/.exec(source)?.[1];
  if (headline === undefined || lead === undefined) {
    throw new Error(`${LANDING} has no hero h1.display and p.lead`);
  }
  return { headline, lead: /^[^.]*\./.exec(lead)?.[0] ?? lead };
}

/**
 * The shapes of `public/icon.svg` without its rounded square, as an inline `<svg>`. The ring,
 * the dot and the body take their colors from the CSS of the tile that holds the mark.
 */
function writeMark(): string {
  const svg = readFileSync(ICON, 'utf8');
  const shapes = [...svg.matchAll(/<(circle|rect) ([^>]*)\/>/g)].filter(
    (match) => !match[2].startsWith('width="64"'),
  );
  if (shapes.length !== 3) {
    throw new Error(`${ICON} no longer has a ring, a dot and a body`);
  }
  const names = ['mark-ring', 'mark-dot', 'mark-body'];
  let markup = '';
  for (const [index, match] of shapes.entries()) {
    markup += `<${match[1]} class="${names[index]}" ${match[2].replaceAll(/ ?(?:fill|stroke|opacity)="[^"]*"/g, '')}/>`;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${markup}</svg>`;
}

/** A font file as a data URL: a page without an origin cannot read `file:` URLs. */
function readFont(name: string): string {
  return `data:font/woff2;base64,${readFileSync(`${ROOT}public/fonts/${name}`).toString('base64')}`;
}

function writePage(copy: Copy): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: 'Bricolage Grotesque'; font-weight: 200 800; src: url(${readFont('bricolage-grotesque.woff2')}) format('woff2'); }
@font-face { font-family: 'Martian Mono'; font-weight: 100 800; src: url(${readFont('martian-mono.woff2')}) format('woff2'); }
${readTokens()}
* { box-sizing: border-box; margin: 0; }
body {
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  display: grid;
  grid-template-columns: 1fr 252px;
  gap: 16px;
  padding: 16px;
  background: var(--bg);
  color: var(--text);
  font-family: 'Bricolage Grotesque', sans-serif;
}
.tile { border-radius: 40px; }
.hero {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 52px 52px;
  background: var(--ink);
  color: var(--on-ink);
}
.brand { display: flex; align-items: center; gap: 14px; font-size: 40px; font-weight: 800; letter-spacing: -0.04em; }
.brand svg { width: 52px; height: 52px; }
.brand .mark-ring { fill: none; stroke: var(--on-ink); stroke-width: 2.4; opacity: 0.4; }
.brand .mark-dot, .brand .mark-body { fill: var(--on-ink); }
h1 { font-size: 98px; font-weight: 800; line-height: 0.98; letter-spacing: -0.05em; }
h1 em {
  display: inline-block;
  margin-top: 0.08em;
  padding: 0 0.18em 0.06em;
  border-radius: 0.24em;
  background: var(--accent-fill);
  color: var(--on-accent);
  font-style: normal;
}
.lead { font-size: 30px; font-weight: 500; letter-spacing: -0.01em; color: var(--on-ink-muted); }
.side { display: grid; grid-template-rows: 1fr 140px; gap: 16px; }
.changed {
  display: grid;
  place-items: center;
  background: var(--accent-fill);
  color: var(--on-accent);
}
.changed svg { width: 150px; height: 150px; }
.changed .mark-ring { fill: none; stroke: var(--on-accent); stroke-width: 2.4; opacity: 0.4; }
.changed .mark-dot, .changed .mark-body { fill: var(--on-accent); }
.install {
  display: grid;
  place-items: center;
  background: var(--bg-elevated);
  font: 600 26px 'Martian Mono', monospace;
}
</style>
</head>
<body>
<section class="tile hero">
  <div class="brand">${writeMark()}idlip</div>
  <h1>${copy.headline}</h1>
  <p class="lead">${copy.lead}</p>
</section>
<div class="side">
  <div class="tile changed">${writeMark()}</div>
  <div class="tile install">npm i idlip</div>
</div>
</body>
</html>`;
}

const browser = await loadChromium().launch();
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.setContent(writePage(readCopy()), { waitUntil: 'load' });
  await page.evaluate('document.fonts.ready.then(() => undefined)');
  await page.screenshot({ path: OUTPUT });
  console.log(`${OUTPUT} written (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
