// Every framework builds the scale page at 10 widgets, and its server renders them all. Each
// build takes a few seconds. Do not run it while `scale.mjs run` is measuring: both write the
// same `scale/dist` folders. The page is fetched from a server process, which the test stops by
// its handle, so no framework runtime stays loaded in the test process.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { widgets } from './dashboard.mjs';
import { FRAMEWORKS, buildApp, checkPage, startServer } from './scale.mjs';

test('the generated widgets are distinct components', () => {
  const list = widgets(1000);
  assert.equal(list.length, 1000);
  const ids = new Set();
  const handlers = new Set();
  for (const widget of list) {
    ids.add(widget.id);
    handlers.add(widget.run.join('\n'));
  }
  assert.equal(ids.size, 1000);
  assert.equal(handlers.size > 900, true);
});

test('a page check fails on a missed click, a missing widget or a page error', () => {
  const good = { clicked: true, domWidgets: 50, htmlWidgets: 50, errors: [] };
  assert.deepEqual(checkPage(good, 50), []);
  assert.equal(checkPage({ ...good, clicked: false }, 50).length, 1);
  assert.equal(checkPage({ ...good, domWidgets: 49 }, 50).length, 1);
  assert.equal(checkPage({ ...good, htmlWidgets: 0 }, 50).length, 1);
  assert.equal(checkPage({ ...good, errors: ['boom'] }, 50).length, 1);
});

for (const framework of FRAMEWORKS) {
  test(`${framework} builds and serves 10 widgets`, { timeout: 300000 }, async () => {
    const built = await buildApp(framework, 10);
    assert.ok(built.ok, built.output);
    const { child, base } = await startServer(framework);
    try {
      const html = await (await fetch(`${base}/`)).text();
      assert.equal(html.match(/class="?widget"?[\s>]/g)?.length, 10);
      assert.ok(html.includes(widgets(10)[9].title));
    } finally {
      child.kill();
    }
  });
}
