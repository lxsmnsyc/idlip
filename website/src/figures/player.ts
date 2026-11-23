// oxlint-disable import/prefer-default-export
// Plays a docs figure. The story is a list of steps from `data-story`. Reaching step n sets the
// class `on-<id>` of every step up to n, so CSS transitions draw each change and reverse when a
// step is left. The server wrote the last step, which stays with reduced motion. The story starts
// when the figure is in view, pauses off screen and in a hidden tab, and stops at the last step.
// A later click on the row replays the click with the code already loaded, and turns the row back.
import type { Step, Story } from './parts.ts';

type Phase =
  // At the first step, until the figure is in view.
  | { kind: 'waiting' }
  // A timer moves to the next step.
  | { kind: 'playing' }
  // Off screen or in a hidden tab while playing, with the time left of the current step.
  | { kind: 'paused'; left: number }
  // At the last step, or where a click on the row put it.
  | { kind: 'stopped' };

type Run =
  // The click that loads the code: the story, or the visitor's click before it reached the press.
  | { kind: 'first' }
  // A click after the row changed. The chunks are cached. `back` puts the row back as the server
  // rendered it, and the next later click changes it again.
  | { kind: 'later'; back: boolean };

/** How long the live line stays empty before it repeats the same text, in milliseconds. */
const REPEAT_MS = 100;

/** How much of the figure shows before it counts as in view. */
const IN_VIEW = 0.4;

function isStory(value: unknown): value is Story {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(Reflect.get(value, 'steps')) &&
    typeof Reflect.get(value, 'press') === 'string' &&
    typeof Reflect.get(value, 'patch') === 'string' &&
    typeof Reflect.get(value, 'live') === 'object'
  );
}

function findStep(steps: readonly Step[], id: string): number {
  for (const [index, step] of steps.entries()) {
    if (step.id === id) {
      return index;
    }
  }
  return steps.length - 1;
}

export function startFigure(root: HTMLElement): void {
  const data: unknown = JSON.parse(root.dataset.story ?? 'null');
  if (!isStory(data)) {
    return;
  }
  const story: Story = data;
  const { steps } = story;
  const last = steps.length - 1;
  const press = findStep(steps, story.press);
  const patch = findStep(steps, story.patch);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = root.querySelector<HTMLElement>('[data-figure-live]');
  const replay = root.querySelector<HTMLButtonElement>('[data-figure-replay]');
  const toggle = root.querySelector<HTMLInputElement>('[data-figure-toggle]');
  const target = root.querySelector<HTMLElement>('[data-target]');
  // The checkbox before and after the click, as the server wrote them on the row.
  const was = target?.style.getPropertyValue('--was').trim() === '1';
  const now = target?.style.getPropertyValue('--now').trim() === '1';

  let index = last;
  let phase: Phase = { kind: 'stopped' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let due = 0;
  let inView = false;
  let run: Run = { kind: 'first' };

  /** Shows step `n`: its classes, its name, and the checkbox. */
  function apply(n: number): void {
    index = n;
    for (const [k, step] of steps.entries()) {
      root.classList.toggle(`on-${step.id}`, k <= n);
    }
    root.dataset.step = steps[n].id;
    // After the patch the row shows `now`, or `was` when a later click puts it back.
    const back = run.kind === 'later' && run.back;
    const patched = n >= patch;
    if (toggle) {
      toggle.checked = patched === back ? was : now;
    }
  }

  /** Sets the run and its classes: `is-cached` for a later click, `is-flipped` when it goes back. */
  function setRun(next: Run): void {
    run = next;
    root.classList.toggle('is-cached', run.kind === 'later');
    root.classList.toggle('is-flipped', run.kind === 'later' && run.back);
  }

  /** Says a line. The same line again is cleared first, so a screen reader reads it again. */
  function announce(text: string): void {
    if (!live) {
      return;
    }
    if (live.textContent === text) {
      live.textContent = '';
      setTimeout(() => {
        live.textContent = text;
      }, REPEAT_MS);
      return;
    }
    live.textContent = text;
  }

  /** The line of the patch: what loaded, or, for a later click, how the row is marked. */
  function sayPatch(): string {
    if (run.kind === 'first') {
      return story.live.loaded;
    }
    return run.back ? story.live.before : story.live.after;
  }

  /** Waits `ms`, then moves to the next step, while the figure is in view and the tab shows. */
  function schedule(ms: number): void {
    clearTimeout(timer);
    if (!inView || document.hidden) {
      phase = { kind: 'paused', left: ms };
      return;
    }
    phase = { kind: 'playing' };
    due = performance.now() + ms;
    timer = setTimeout(advance, ms);
  }

  function advance(): void {
    apply(index + 1);
    if (index === patch) {
      announce(sayPatch());
    }
    if (index >= last) {
      phase = { kind: 'stopped' };
      return;
    }
    schedule(steps[index].ms);
  }

  /** Plays from step `n`. With reduced motion it shows the last step at once. */
  function playFrom(n: number): void {
    if (reduced) {
      apply(last);
      announce(sayPatch());
      phase = { kind: 'stopped' };
      return;
    }
    apply(n);
    schedule(steps[n].ms);
  }

  function pause(): void {
    if (phase.kind === 'playing') {
      clearTimeout(timer);
      phase = { kind: 'paused', left: Math.max(0, due - performance.now()) };
    }
  }

  /** Starts the story the first time the figure is in view, and resumes it after a pause. */
  function resume(): void {
    if (!inView || document.hidden) {
      return;
    }
    if (phase.kind === 'waiting') {
      playFrom(0);
    } else if (phase.kind === 'paused') {
      schedule(phase.left);
    }
  }

  // A click on the row before the press plays the click from there, without the pointer. While
  // the click runs, the row takes no other. After it, a click replays the loop with the code
  // cached, and the row goes back, then forth.
  toggle?.addEventListener('click', (event) => {
    if (index >= press && index < patch) {
      event.preventDefault();
      return;
    }
    clearTimeout(timer);
    root.classList.add('is-hands');
    if (index >= patch) {
      setRun(
        run.kind === 'later' ? { kind: 'later', back: !run.back } : { kind: 'later', back: true },
      );
    }
    playFrom(press);
  });
  replay?.addEventListener('click', () => {
    clearTimeout(timer);
    root.classList.remove('is-hands');
    setRun({ kind: 'first' });
    playFrom(0);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
    } else {
      resume();
    }
  });
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting && entry.intersectionRatio >= IN_VIEW;
      }
      if (inView) {
        resume();
      } else {
        pause();
      }
    },
    { threshold: [0, IN_VIEW] },
  );

  // The row and the replay button take input from now on. With reduced motion there is nothing to
  // replay, and the figure stays at the last step the server wrote.
  if (toggle) {
    toggle.disabled = false;
  }
  if (reduced) {
    return;
  }
  if (replay) {
    replay.hidden = false;
  }

  // Move from the last step to the first in one frame with no transition, then wait to be seen.
  root.classList.add('is-snap');
  apply(0);
  root.getBoundingClientRect();
  root.classList.remove('is-snap');
  phase = { kind: 'waiting' };
  observer.observe(root);
}
