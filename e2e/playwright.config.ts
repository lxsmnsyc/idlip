import { defineConfig, devices } from '@playwright/test';

// The ports come from the environment, so parallel worktrees can run side by side.
const port = Number(process.env.E2E_PORT ?? 4173);
const countersPort = Number(process.env.E2E_COUNTERS_PORT ?? 4174);
const subsPort = Number(process.env.E2E_SUBS_PORT ?? 4175);
const hotPort = Number(process.env.E2E_HOT_PORT ?? 4576);

// `example` (default) serves the built `examples/todo`, `examples/counters` and
// `examples/counters-subs`: run `pnpm build` first. `fixture` serves the golden todo fixture and
// skips the other two. The todo servers answer `GET /?props=<json>` with the page rendered for
// those props.
const targets = {
  fixture: { command: 'node fixture/server.ts', cwd: '.' },
  example: { command: `pnpm --filter todo preview --port ${port} --strictPort`, cwd: '..' },
};

const name = process.env.E2E_TARGET ?? 'example';
if (name !== 'fixture' && name !== 'example') {
  throw new Error(`E2E_TARGET must be "fixture" or "example", got "${name}"`);
}
const target = targets[name];
const withApps = name === 'example';

function createServer(
  command: string,
  cwd: string,
  at: number,
): {
  command: string;
  cwd: string;
  url: string;
  env: Record<string, string>;
  reuseExistingServer: false;
  timeout: number;
} {
  return {
    command,
    cwd,
    url: `http://127.0.0.1:${at}/`,
    env: { PORT: String(at) },
    reuseExistingServer: false,
    timeout: 60_000,
  };
}

const todoServer = createServer(target.command, target.cwd, port);
const countersServer = createServer(
  `pnpm --filter counters preview --port ${countersPort} --strictPort`,
  '..',
  countersPort,
);
const subsServer = createServer(
  `pnpm --filter counters-subs preview --port ${subsPort} --strictPort`,
  '..',
  subsPort,
);

// `vite dev` of copies of the todo and of `counters-subs` (`fixture/hot-app.ts`), for the hot
// update tests, which edit the copies. The dev server answers a page only to a request that
// accepts HTML, so the check reads its client.
function createHotServer(example: string, at: number): ReturnType<typeof createServer> {
  return {
    ...createServer(
      `node e2e/fixture/hot-app.ts ${example} && cd e2e/.hot/${example} && ./node_modules/.bin/vite --port ${at} --strictPort --host 127.0.0.1`,
      '..',
      at,
    ),
    url: `http://127.0.0.1:${at}/@vite/client`,
  };
}
const hotServer = createHotServer('todo', hotPort);
const hotChildrenServer = createHotServer('counters-subs', hotPort + 1);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    {
      name: 'chromium',
      testIgnore: /(nested(-subscribe)?|hot|hot-children)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${port}` },
    },
    ...(withApps
      ? [
          {
            name: 'hot',
            testMatch: /hot\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${hotPort}` },
          },
          {
            name: 'hot-children',
            testMatch: /hot-children\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${hotPort + 1}` },
          },
          {
            name: 'counters',
            testMatch: /nested\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${countersPort}` },
          },
          {
            name: 'counters-subs',
            testMatch: /nested-subscribe\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${subsPort}` },
          },
        ]
      : []),
  ],
  webServer: withApps
    ? [todoServer, countersServer, subsServer, hotServer, hotChildrenServer]
    : [todoServer],
});
