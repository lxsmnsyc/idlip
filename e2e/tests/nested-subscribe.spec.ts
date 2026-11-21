import { expect, test } from './support.ts';

test('a subscription in a child loads its source from the child module', async ({ page }) => {
  // A source chunk resolved against the root's manifest would fail to load, and `problems` fails
  // the test on that.
  const requests: string[] = [];
  page.on('request', (request) => {
    requests.push(new URL(request.url()).pathname);
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  const sources = requests.filter((path) => path.includes('.source.'));
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatch(/\/counter\.source\.idle\./);
});
