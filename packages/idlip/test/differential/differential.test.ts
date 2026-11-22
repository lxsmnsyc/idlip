// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Model } from '../../src/core/format.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';
import { DIVERGENCES, findDivergence } from './divergences.ts';
import { open } from './harness.ts';
import { createRandom, mutateModel } from './states.ts';
import { SUBJECTS } from './subjects.ts';

/** Seeds per subject. Each seed makes three model pairs. */
const SEEDS = 40;
/** Rounds of clicking every handler element of a page. */
const ROUNDS = 2;

/** The accepted divergences that a run met, as `id:subject`, with their counts. */
const met = new Map<string, number>();
const totals = { pairs: 0, steps: 0, skipped: 0 };
/** The share of pairs the server may fail to render before the test fails. */
const MAX_SKIPPED = 0.1;

/** Returns the difference unless an accepted divergence explains it. */
function judge(subject: string, difference: string | undefined): string | undefined {
  if (difference === undefined) {
    return undefined;
  }
  const divergence = findDivergence(subject, difference);
  if (divergence === undefined) {
    return difference;
  }
  const key = `${divergence.id}:${subject}`;
  met.set(key, (met.get(key) ?? 0) + 1);
  return undefined;
}

/** Clicks the element at an index and returns what `settled` threw, which is a difference. */
async function clickAt(
  page: MountedPage,
  selector: string,
  index: number,
): Promise<string | undefined> {
  const target = [...page.root.querySelectorAll<HTMLElement>(selector)].at(index);
  if (target === undefined) {
    return undefined;
  }
  target.click();
  totals.steps++;
  try {
    // `settled` compares the page with a server render of the model.
    await page.settled();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

describe.each(SUBJECTS)('$name', (subject) => {
  it.skipIf(subject.children !== undefined)(
    'patches any model to any model like a server render',
    async () => {
      const page = await open(subject);
      const failures: string[] = [];
      try {
        const pairs: (readonly [Model, Model])[] = [...(subject.pairs?.(page.initial) ?? [])];
        for (let seed = 1; seed <= SEEDS; seed++) {
          const random = createRandom(seed * 7919);
          const first = mutateModel(random, page.keys, page.initial);
          const second = mutateModel(random, page.keys, page.initial);
          pairs.push([page.initial, first], [first, page.initial], [first, second]);
        }
        for (const [index, [from, to]] of pairs.entries()) {
          if (page.render(from) === undefined || page.render(to) === undefined) {
            totals.skipped++;
            continue;
          }
          totals.pairs++;
          // oxlint-disable-next-line no-await-in-loop
          const difference = judge(subject.name, await page.patch(from, to));
          if (difference !== undefined) {
            failures.push(`pair ${index}: ${difference}`);
          }
        }
      } finally {
        page.close();
      }
      expect(failures).toEqual([]);
    },
  );

  it('keeps the page equal to a server render after each handler', async () => {
    const page = await mount(subject.source, subject.props, {
      expectCaught: true,
      children: subject.children,
    });
    const selector = subject.clicks ?? '[on\\:click]';
    try {
      for (let round = 0; round < ROUNDS; round++) {
        const count = page.root.querySelectorAll(selector).length;
        for (let index = 0; index < count; index++) {
          // oxlint-disable-next-line no-await-in-loop
          const message = await clickAt(page, selector, index);
          expect(judge(subject.name, message), message).toBeUndefined();
        }
      }
    } finally {
      page.stop();
    }
  });
});

describe('accepted divergences', () => {
  it('lists only differences that a run still produces', () => {
    const stale: string[] = [];
    for (const divergence of DIVERGENCES) {
      for (const subject of divergence.subjects) {
        if (!met.has(`${divergence.id}:${subject}`)) {
          stale.push(`${divergence.id} in ${subject}`);
        }
      }
    }
    expect(stale).toEqual([]);
    expect(totals.pairs).toBeGreaterThan(0);
    // A generator or server regression that makes most pairs unrenderable must not pass quietly.
    expect(totals.skipped / (totals.pairs + totals.skipped)).toBeLessThanOrEqual(MAX_SKIPPED);
  });
});
