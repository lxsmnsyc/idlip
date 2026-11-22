// Profiles the rows page: the self time of each function for one operation, from a CPU profile.
// Each round loads a new page, runs the operation's warmup from `client.mjs`, then profiles the
// measured click.
// Usage: node profile-rows.mjs <framework> <operation> [rounds]
// The operation is a key of `OPERATIONS` (create1k, replace1k, update10th, select, swap, remove,
// create10k, append1k, clear), or create, replace or append.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';
import { OPERATIONS, snapshot, waitDone } from './client.mjs';

const ALIASES = { create: 'create1k', replace: 'replace1k', append: 'append1k' };
const [name = 'brumate', op = 'create', roundsArg = '5'] = process.argv.slice(2);
const operation = OPERATIONS[ALIASES[op] ?? op];
if (operation === undefined) {
  throw new Error(`Unknown operation ${op}`);
}
const rounds = Number(roundsArg);
const server = spawn(process.execPath, ['serve.mjs', name, 'rows'], { cwd: import.meta.dirname });
const port = await new Promise((resolve) => {
  server.stdout.on('data', (chunk) => {
    const match = /ready (\d+)/.exec(String(chunk));
    if (match) {
      resolve(Number(match[1]));
    }
  });
});
const self = new Map();
let total = 0;
const browser = await chromium.launch({ ...findChrome(), headless: true });
try {
  for (let round = 0; round < rounds; round++) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/?n=0`, { waitUntil: 'networkidle' });
    await operation.setup(page);
    const before = await snapshot(page);
    const session = await page.context().newCDPSession(page);
    await session.send('Profiler.enable');
    await session.send('Profiler.setSamplingInterval', { interval: 50 });
    await session.send('Profiler.start');
    await page.click(operation.click);
    await waitDone(page, operation.done, before);
    const { profile } = await session.send('Profiler.stop');
    await page.close();
    const byId = new Map();
    for (const node of profile.nodes) {
      byId.set(node.id, node);
    }
    const interval = (profile.endTime - profile.startTime) / profile.samples.length;
    for (const id of profile.samples) {
      const frame = byId.get(id).callFrame;
      const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()}:${frame.lineNumber}`;
      self.set(key, (self.get(key) ?? 0) + interval / 1000);
      if (!/\(idle\)|\(program\)/.test(frame.functionName)) {
        total += interval / 1000;
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`${name} ${op}: ${(total / rounds).toFixed(1)} ms of script and native work a round`);
for (const [key, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 28)) {
  console.log(`${(ms / rounds).toFixed(2).padStart(7)} ms  ${key}`);
}
