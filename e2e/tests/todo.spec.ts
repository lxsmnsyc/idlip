import { gzipSync } from 'node:zlib';
import {
  collectRequests,
  expect,
  initial,
  readMain,
  renderFresh,
  settle,
  test,
} from './support.ts';

// Contract budgets (compiled-format, Listener and early events), `gzip -9`.
const listenerBudget = 1024;
const loaderBudget = 4096;

test.describe('scripts off', () => {
  test.use({ javaScriptEnabled: false });

  test('the server render works before any script runs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Write the format')).toBeVisible();
    await expect(page.getByText('Build <the> runtime')).toBeVisible();
    await expect(page.locator('p')).toHaveText('1 left');
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked();
  });
});

test.describe('csp probe', () => {
  // The probe provokes one console error on purpose.
  test.use({ expectedProblems: 1 });

  test('the page runs under a strict CSP', async ({ page, problems }) => {
    const response = await page.goto('/');
    const policy = response?.headers()['content-security-policy'] ?? '';
    expect(policy).toMatch(/script-src 'nonce-[\w+/=]+' 'strict-dynamic'/);
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toContain('trusted-types idlip');
    // The page's own scripts raised no violation.
    expect(await page.evaluate(() => window.idlipViolations)).toEqual([]);
    // A script without the nonce is blocked, and so is a Trusted Types sink fed a string.
    const outcome = await page.evaluate(() => {
      const script = document.createElement('script');
      try {
        script.textContent = 'window.injected = true';
      } catch {
        return 'trusted-types';
      }
      return 'allowed';
    });
    expect(outcome).toBe('trusted-types');
    const injected: unknown = await page.evaluate((): unknown => Reflect.get(window, 'injected'));
    expect(injected).toBeUndefined();
    // The blocked assignment is the one expected console error.
    expect(problems).toHaveLength(1);
  });
});

test('nothing loads or decodes before the first event', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const requests = await collectRequests(page, async () => {
    // Pointer movement and focus are not handled events.
    await page.getByRole('checkbox').first().hover();
    await settle(page);
  });
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => window.idlipDecoded)).toBe(0);
});

test('the first click loads the toggle chunk and the changed binding chunk only', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const second = page.getByRole('checkbox').nth(1);
  const chunks = await collectRequests(page, async () => {
    await second.click();
    await expect(page.locator('p')).toHaveText('0 left');
  });
  expect(chunks.toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle']);
  expect(await page.evaluate(() => window.idlipDecoded)).toBe(1);
});

test('a later click on the same handler loads nothing', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox').nth(1).click();
  await expect(page.locator('p')).toHaveText('0 left');
  const chunks = await collectRequests(page, async () => {
    await page.getByRole('checkbox').first().click();
    await expect(page.locator('p')).toHaveText('1 left');
  });
  expect(chunks).toEqual([]);
  // The state decoded once, for the first event.
  expect(await page.evaluate(() => window.idlipDecoded)).toBe(1);
});

test('a click before the page scripts finish loading still applies', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Hold every script request, so the click lands before any module runs.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') {
      await held;
    }
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  const second = page.getByRole('checkbox').nth(1);
  await second.waitFor();
  await second.click();
  // Nothing has patched yet, and the listener has queued the event.
  await expect(page.locator('p')).toHaveText('1 left');
  release();
  await expect(page.locator('p')).toHaveText('0 left');
  await expect(second).toBeChecked();
});

test('the DOM after each action equals a fresh server render', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.getByRole('checkbox').nth(1).click();
  await expect(page.locator('p')).toHaveText('0 left');
  const afterFirst = initial.map((todo) => ({ ...todo, done: true }));
  expect(await readMain(page)).toBe(await renderFresh(page, afterFirst));

  await page.getByRole('checkbox').first().click();
  await expect(page.locator('p')).toHaveText('1 left');
  const afterSecond = [
    { ...initial[0], done: false },
    { ...initial[1], done: true },
  ];
  expect(await readMain(page)).toBe(await renderFresh(page, afterSecond));
});

function gzipSize(code: string): number {
  return gzipSync(code, { level: 9 }).length;
}

function resolveImport(specifier: string, from: string, map: Record<string, string>): string {
  return new URL(map[specifier] ?? specifier, from).href;
}

function readImports(json: string): Record<string, string> {
  const parsed: unknown = JSON.parse(json);
  const imports: Record<string, string> = {};
  const given: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'imports') : {};
  for (const [name, target] of typeof given === 'object' && given !== null
    ? Object.entries(given)
    : []) {
    if (typeof target === 'string') {
      imports[name] = target;
    }
  }
  return imports;
}

function findStaticImports(code: string): string[] {
  const found: string[] = [];
  const pattern = /(?:^|[;}\s])(?:import|export)\s*(?:[^'"()]*?\bfrom\s*)?(['"])([^'"]+)\1/g;
  for (const match of code.matchAll(pattern)) {
    found.push(match[2]);
  }
  return found;
}

test('the listener and the loader stay within their gzip budgets', async ({ page, baseURL }) => {
  const response = await page.request.get('/');
  const html = await response.text();

  // The listener is the inline script in the head that is neither the import map nor a module.
  const inline = [
    ...html.matchAll(/<script(?![^>]*(?:src=|type=|i-state))[^>]*>([\s\S]*?)<\/script>/g),
  ];
  expect(inline).toHaveLength(1);
  expect(gzipSize(inline[0][1])).toBeLessThanOrEqual(listenerBudget);

  // The loader is the module script, counted with its static imports.
  const map = /<script type="importmap"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  const imports = readImports(map?.[1] ?? '{}');
  const entry = /<script type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
  expect(entry).toBeDefined();
  const seen = new Set<string>();
  const queue = [resolveImport(entry ?? '', `${baseURL}/`, {})];
  let total = 0;
  for (let url = queue.pop(); url !== undefined; url = queue.pop()) {
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    const code = await (await page.request.get(url)).text();
    total += gzipSize(code);
    for (const specifier of findStaticImports(code)) {
      queue.push(resolveImport(specifier, url, imports));
    }
  }
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(loaderBudget);
});
