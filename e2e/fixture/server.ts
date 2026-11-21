// Serves the golden todo fixture with a strict CSP, until `example-todo` replaces it.
// The page is the fixture's `page.html`, rendered again with the props in `?props=`.
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import getChunkName from './chunk.ts';
import { getChunkFile } from '../../packages/idlip/src/core/format.ts';
import { createContext } from '../../packages/idlip/test/fixtures/reference.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixture = `${root}packages/idlip/test/fixtures/todo`;
const stubs = fileURLToPath(new URL('./stub', import.meta.url));
const referenceUrl = pathToFileURL(`${root}packages/idlip/test/fixtures/reference.ts`).href;

interface Rendered {
  readonly default: (props: unknown, context: unknown) => string;
}

function isRendered(value: unknown): value is Rendered {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'default') === 'function'
  );
}

function readProps(json: string): unknown {
  const parsed: unknown = JSON.parse(json);
  return typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'props') : undefined;
}

async function loadServerModule(): Promise<Rendered> {
  const source = await readFile(`${fixture}/expected/server.js`, 'utf8');
  // The reference helpers stand in for `idlip/server` until `ssr-render` ships it.
  const code = source.replace("from 'idlip/server'", `from '${referenceUrl}'`);
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const loaded: unknown = await import(url);
  if (!isRendered(loaded)) {
    throw new TypeError('The fixture server module has no default export');
  }
  return loaded;
}

async function renderBody(nonce: string, query: URLSearchParams): Promise<string> {
  const given = query.get('props');
  const props: unknown =
    given === null ? readProps(await readFile(`${fixture}/input.json`, 'utf8')) : JSON.parse(given);
  const module = await loadServerModule();
  const { context, writeState } = createContext();
  const html = module.default(props, context);
  const state = writeState().replace('<script i-state>', `<script i-state nonce="${nonce}">`);
  return html + state;
}

async function renderPage(nonce: string, query: URLSearchParams): Promise<string> {
  const listener = await readFile(`${stubs}/listener.js`, 'utf8');
  const body = await renderBody(nonce, query);
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>todo</title>` +
    `<script nonce="${nonce}">${listener}</script>` +
    `<script type="importmap" nonce="${nonce}">{"imports":{"idlip/client":"/stub/client.js"}}</script>` +
    `<script type="module" src="/stub/loader.js" nonce="${nonce}"></script>` +
    `</head><body>${body}</body></html>`
  );
}

function getPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    'trusted-types idlip',
  ].join('; ');
}

function send(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(body);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/') {
    const nonce = randomBytes(16).toString('base64');
    response.setHeader('content-security-policy', getPolicy(nonce));
    send(response, 200, 'text/html', await renderPage(nonce, url.searchParams));
    return;
  }
  if (url.pathname.startsWith('/stub/')) {
    const file = url.pathname.slice('/stub/'.length);
    if (file === 'loader.js' || file === 'client.js') {
      send(response, 200, 'text/javascript', await readFile(`${stubs}/${file}`, 'utf8'));
      return;
    }
  }
  const chunk = getChunkName(url.href);
  if (chunk !== undefined) {
    const code = await readFile(`${fixture}/expected/client/${getChunkFile(chunk)}`, 'utf8');
    send(response, 200, 'text/javascript', code);
    return;
  }
  send(response, 404, 'text/plain', 'Not found');
}

const server = createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    send(response, 500, 'text/plain', String(error));
  });
});

server.listen(Number(process.env.PORT ?? 4173), '127.0.0.1');
