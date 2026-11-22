// @vitest-environment happy-dom
// Scratch: prints the first failing pair of a differential subject. Not committed.
import { it } from 'vitest';
import { open } from '../differential/harness.ts';
import { createRandom, mutateModel } from '../differential/states.ts';
import { SUBJECTS } from '../differential/subjects.ts';

it.skipIf(process.env.SUBJ === undefined)('debug', async () => {
  const subject = SUBJECTS.find((s) => s.name === (process.env.SUBJ ?? 'nested-blocks'))!;
  const page = await open(subject);
  for (let seed = 1; seed <= 40; seed++) {
    const random = createRandom(seed * 7919);
    const first = mutateModel(random, page.keys, page.initial);
    const second = mutateModel(random, page.keys, page.initial);
    for (const [from, to] of [
      [page.initial, first],
      [first, page.initial],
      [first, second],
    ]) {
      if (page.render(from) === undefined || page.render(to) === undefined) {
        continue;
      }
      try {
        const d = await page.patch(from, to);
        if (d) {
          console.log('DIFF', d, '\n', JSON.stringify(from), '\n', JSON.stringify(to));
          return;
        }
      } catch (e) {
        console.log('ERR', String(e), '\n', JSON.stringify(from), '\n', JSON.stringify(to), '\n', page.render(from));
        return;
      }
    }
  }
});
