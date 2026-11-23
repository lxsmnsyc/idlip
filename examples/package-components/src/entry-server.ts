import { renderToResponse } from 'idlip/server';
import App from './app.tsx';

const items = [
  { id: 'a1', label: 'Apples', start: 0 },
  { id: 'a2', label: 'Pears', start: 2 },
];

const server = {
  // Nitro calls `fetch` for each request that is not a file of the build. No preload links, so a
  // click is what loads a chunk.
  async fetch(): Promise<Response> {
    return renderToResponse(App, { items }, { csp: true, preload: false });
  },
};

export default server;
