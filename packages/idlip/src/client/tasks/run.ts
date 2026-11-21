import type { Message, Outcome, Page, Task, Update } from '../../core/format.ts';

type Run = (...args: unknown[]) => unknown;
type Sent = Message<string, readonly unknown[]>;

/** What the loader gives a task: its page and the ways back into the queue. */
export interface TaskHost {
  readonly page: Page;
  /** Runs a message through an update now, inside the current batch. */
  readonly apply: (update: Update, message: Sent) => Promise<void>;
  /** Queues a message as an event without a DOM target. */
  readonly push: (message: Sent) => void;
  readonly report: (error: unknown) => void;
}

/**
 * Runs an awaited call and dispatches its continuation with `[outcome, ...carried]`.
 * `manifest.tasks[site]` is the chunk of the call. A `task=<site>` chunk exports `run`, and
 * the continuation is queued when it settles. A `handler=<name>` chunk means a built-in,
 * exported as `task$<site>`, and the continuation runs before this call returns. A chunk that
 * fails to load, or lacks the function, rejects, so no continuation runs. A task that throws
 * or rejects settles as `{ ok: false, error }`.
 */
export async function runTask(host: TaskHost, { site, args, then, carried }: Task): Promise<void> {
  const { manifest, load } = host.page;
  const file = manifest.tasks && Object.hasOwn(manifest.tasks, site) ? manifest.tasks[site] : '';
  const builtIn = file.startsWith('handler=');
  const job = (async () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const chunk = (await load(manifest.module, file)) as Readonly<Record<string, unknown>>;
    const run = chunk[builtIn ? `task$${site}` : 'run'];
    if (typeof run !== 'function') {
      throw new TypeError(`idlip: no task for ${site}`);
    }
    let outcome: Outcome;
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      outcome = { ok: true, value: await Reflect.apply(run as Run, host.page.root, args) };
    } catch (error) {
      outcome = { ok: false, error };
    }
    const message = { t: then, p: [outcome, ...carried] };
    if (builtIn) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      await host.apply(chunk[then] as Update, message);
    } else {
      host.push(message);
    }
  })();
  if (builtIn) {
    await job;
  } else {
    job.catch(host.report);
  }
}
