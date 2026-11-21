import { defineConfig, devices } from '@playwright/test';

const port = 4173;

// `example` (default) serves the built `examples/todo`: run `pnpm build` first. `fixture` serves
// the golden todo fixture. Both answer `GET /?props=<json>` with the page rendered for those props.
const targets = {
  fixture: { command: 'node fixture/server.ts', cwd: '.' },
  example: { command: 'pnpm --filter todo preview --port 4173 --strictPort', cwd: '..' },
};

const name = process.env.E2E_TARGET ?? 'example';
if (name !== 'fixture' && name !== 'example') {
  throw new Error(`E2E_TARGET must be "fixture" or "example", got "${name}"`);
}
const target = targets[name];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: target.command,
    cwd: target.cwd,
    url: `http://127.0.0.1:${port}/`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
