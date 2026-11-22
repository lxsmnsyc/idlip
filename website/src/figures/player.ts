// oxlint-disable import/prefer-default-export
// Plays a docs figure. The story is a list of steps from `data-story`. Reaching step n sets the
// class `on-<id>` of every step up to n, so CSS transitions draw each change and reverse when a
// step is left. The server wrote the last step, which stays with reduced motion. The story starts
// when the figure is in view, pauses off screen and in a hidden tab, and stops at the last step.
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

/** How much of the figure shows before it counts as in view. */
const IN_VIEW = 0.4;

function isStory(value: unknown): value is Story {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(Reflect.get(value, 'steps')) &&
    typeof Reflect.get(value, 'press') === 'string' &&
    typeof Reflect.get(value, 'patch') === 'string' &&
    typeof Reflect.get(value, 'back') === 'string' &&
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
  const back = findStep(steps, story.back);
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

  /** Shows step `n`: its classes, its name, and the checkbox. */
  function apply(n: number): void {
    index = n;
    for (const [k, step] of steps.entries()) {
      root.classList.toggle(`on-${step.id}`, k <= n);
    }
    root.dataset.step = steps[n].id;
    if (toggle) {
      toggle.checked = n >= patch ? now : was;
    }
  }

  function announce(text: string): void {
    if (live) {
      live.textContent = text;
    }
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
      announce(story.live.done);
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
      announce(story.live.done);
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
  // the click runs, the row takes no other. After it, a click puts the row back as it was.
  toggle?.addEventListener('click', (event) => {
    if (index >= press && index < patch) {
      event.preventDefault();
      return;
    }
    clearTimeout(timer);
    root.classList.add('is-hands');
    if (index < press) {
      playFrom(press);
      return;
    }
    apply(back);
    phase = { kind: 'stopped' };
    announce(story.live.undone);
  });
  replay?.addEventListener('click', () => {
    clearTimeout(timer);
    root.classList.remove('is-hands');
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
