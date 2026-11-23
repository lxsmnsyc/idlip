// State script bytes, SSR renders/s or a Node profile of the idlip benchmark page.
// Build first: `pnpm --filter idlip build`, then `pnpm build` and `pnpm build:dashboard` in benchmarks/idlip.
// usage: node ssr-ab.mjs <repo root> <dashboard|todos> <size|speed|prof>
import { gzipSync } from 'node:zlib';
import { Session } from 'node:inspector/promises';
const [repo, scenario, mode] = process.argv.slice(2);
const { loadApp } = await import(`${repo}/benchmarks/harness/frameworks.mjs`);
const app = await loadApp('idlip', scenario);
const go = () => (scenario === 'dashboard' ? app.render() : app.render(3));
if (mode === 'size') {
  const html = await go();
  const m = html.match(/<script i-state[^>]*>[\s\S]*?<\/script>/g) ?? [];
  const state = m.reduce((a, s) => a + s.length, 0);
  console.log(
    `html ${Buffer.byteLength(html)} gzip ${gzipSync(html, { level: 9 }).length} state ${state} stategzip ${gzipSync(m.join(''), { level: 9 }).length}`,
  );
} else if (mode === 'speed') {
  for (let i = 0; i < 300; i++) Buffer.from(await go());
  let n = 0;
  let sink = 0;
  const t = performance.now();
  while (performance.now() - t < 1500) {
    sink += Buffer.from(await go()).length;
    n++;
  }
  console.log(`rps ${(n / ((performance.now() - t) / 1000)).toFixed(0)}`);
} else {
  for (let i = 0; i < 300; i++) Buffer.from(await go());
  const session = new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.start');
  const t = performance.now();
  const count = 1000;
  for (let i = 0; i < count; i++) Buffer.from(await go());
  const ms = performance.now() - t;
  const { profile } = await session.post('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = (profile.endTime - profile.startTime) / profile.samples.length / 1000;
  for (const id of profile.samples) {
    const f = byId.get(id).callFrame;
    const k = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`;
    self.set(k, (self.get(k) ?? 0) + dt);
  }
  console.log(`${scenario}: ${(ms / count).toFixed(3)} ms a render`);
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`${((v / ms) * 100).toFixed(1).padStart(5)}%  ${k}`);
  }
}
