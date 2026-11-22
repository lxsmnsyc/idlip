// The hero picture. A page renders once, the loader arrives, and a click on one todo wakes the
// todo block: Update loads the handler chunk, the model changes one path, and View loads the
// binding chunk and changes one row and the count. Every visual is a function of the time `t`
// (0 to 1), so the timeline under the page can be scrubbed both ways. The server writes the names,
// sizes and moments in `data-story` and draws the still frame. With reduced motion, or without
// this script, the picture stays at that still frame. The picture is a model: nothing is fetched.

type Moment =
  | 'render'
  | 'modeled'
  | 'rendered'
  | 'seal'
  | 'load'
  | 'aim'
  | 'click'
  | 'unfold'
  | 'update'
  | 'model'
  | 'view'
  | 'patch'
  | 'fold';

interface Story {
  /** When each moment starts, from 0 to 1. */
  at: Record<Moment, number>;
  /** The moments that set an `on-<name>` class. */
  classes: Moment[];
  /** The time of the still frame. */
  still: number;
  /** The slider texts, by the time each one starts. */
  steps: [number, string][];
  /** The live line: after the first load, and after a later click. */
  live: { first: string; later: string };
}

type Phase =
  // Plays to the end and clicks the todo by itself.
  | { kind: 'auto' }
  // The visitor has a hand on the picture: it plays up to the pointer and waits for their click.
  | { kind: 'hands-on' }
  // The visitor clicked the todo: the loop plays to the end, with no pointer.
  | { kind: 'replay' }
  // Stopped: at the end, with reduced motion, or where the visitor scrubbed to.
  | { kind: 'still' };

/** How long the story takes from 0 to 1, in milliseconds. */
const STORY_MS = 8000;

/** How long the "cached" mark shows after a later click, in milliseconds. */
const HIT_MS = 1200;

/** How far each key moves the timeline. */
const KEY_STEPS = new Map([
  ['ArrowLeft', -0.02],
  ['ArrowDown', -0.02],
  ['ArrowRight', 0.02],
  ['ArrowUp', 0.02],
  ['Home', -1],
  ['End', 1],
]);

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** 0 before `edge0`, 1 after `edge1`, and a smooth step between them. */
function smooth(edge0: number, edge1: number, value: number): number {
  const k = clamp((value - edge0) / (edge1 - edge0));
  return k * k * (3 - 2 * k);
}

function isStory(value: unknown): value is Story {
  return (
    typeof value === 'object' &&
    value !== null &&
    'at' in value &&
    'classes' in value &&
    'still' in value &&
    'steps' in value &&
    'live' in value
  );
}

function start(stage: HTMLElement, story: Story): void {
  const { at } = story;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = stage.querySelector<HTMLElement>('[data-hero-live]');
  const count = stage.querySelector<HTMLElement>('[data-left]');
  const knob = stage.querySelector<HTMLButtonElement>('.hero-knob');
  const track = stage.querySelector<HTMLElement>('[data-scrub]');
  const cached = stage.querySelector<HTMLElement>('.hero-cached');
  const rows: HTMLElement[] = [];
  const inputs: HTMLInputElement[] = [];
  // The done state of each row before the click, and the one the visitor's clicks set after it.
  const before: boolean[] = [];
  const after: boolean[] = [];
  let target = 0;
  for (const row of stage.querySelectorAll<HTMLElement>('[data-row]')) {
    const input = row.querySelector('input');
    if (!input) {
      continue;
    }
    if (row.hasAttribute('data-target')) {
      target = rows.length;
    }
    const rest = row.dataset.rest === '1';
    rows.push(row);
    inputs.push(input);
    before.push(rest);
    after.push(row.hasAttribute('data-target') ? !rest : rest);
  }

  let t = reduced ? story.still : 0;
  let phase: Phase = reduced ? { kind: 'still' } : { kind: 'auto' };
  let last = 0;
  let frame = 0;
  let offscreen = false;
  let announced = reduced;
  let hitTimer: ReturnType<typeof setTimeout> | undefined;

  /** Draws the picture at `t`: custom properties per frame, classes per moment, and the rows. */
  function render(): void {
    // The server render: a scan passes once and each block shows as it is reached.
    const pass = smooth(at.render, at.rendered, t);
    const scan =
      t > at.render && t < at.rendered + 0.02
        ? 1 - smooth(at.rendered - 0.02, at.rendered + 0.02, t)
        : 0;

    // After the click the other blocks dim, the todo block lifts, and the loop opens beside it.
    const dim = smooth(at.click, at.update, t);
    const lift = smooth(at.click, at.unfold + 0.02, t) * (1 - smooth(at.fold, at.fold + 0.04, t));
    const open = smooth(at.unfold, at.unfold + 0.02, t) * (1 - smooth(at.fold, at.fold + 0.025, t));

    // The pointer of the autoplay comes in, presses and leaves. It shows only in the autoplay.
    const come = smooth(at.aim, at.click - 0.02, t);
    const away = smooth(at.click + 0.03, at.click + 0.08, t);
    const pointer =
      phase.kind === 'auto' ? Math.min(smooth(at.aim, at.aim + 0.04, t), 1 - away) : 0;

    const values: [string, number][] = [
      ['--t', t],
      ['--pass', pass],
      ['--scan', scan],
      ['--dim', dim],
      ['--lift', lift],
      ['--open', open],
      ['--come', come],
      ['--pointer', pointer],
    ];
    for (const [name, value] of values) {
      stage.style.setProperty(name, value.toFixed(4));
    }
    for (const name of story.classes) {
      stage.classList.toggle(`on-${name}`, t >= at[name]);
    }
    stage.classList.toggle('on-press', t >= at.click - 0.012 && t < at.click + 0.012);
    let step = 'click';
    if (t < at.load) {
      step = 'render';
    } else if (t < at.click) {
      step = 'load';
    }
    stage.dataset.step = step;

    // The rows show the server's todos until the patch, then the visitor's.
    let left = 0;
    for (const [index, row] of rows.entries()) {
      const done = t >= at.patch ? after[index] : before[index];
      row.style.setProperty('--done', done ? '1' : '0');
      inputs[index].checked = done;
      if (!done) {
        left++;
      }
    }
    if (count) {
      count.textContent = String(left);
    }

    // The slider says where the story is.
    if (knob) {
      let text = '';
      for (const [from, line] of story.steps) {
        if (from <= t) {
          text = line;
        }
      }
      knob.setAttribute('aria-valuenow', String(Math.round(t * 100)));
      knob.setAttribute('aria-valuetext', text);
    }
  }

  /** Says what happened in the live line, for screen readers. */
  function announce(text: string): void {
    if (live) {
      live.textContent = text;
    }
  }

  /** Where the playback stops in the current phase, or `undefined` when it does not play. */
  function findEnd(): number | undefined {
    if (phase.kind === 'still') {
      return undefined;
    }
    return phase.kind === 'hands-on' ? Math.max(t, at.aim) : 1;
  }

  function tick(now: number): void {
    frame = 0;
    const dt = last ? now - last : 0;
    last = now;
    const end = findEnd();
    if (end === undefined) {
      return;
    }

    // Move the time on, and say once what loaded when both chunks are in.
    const was = t;
    t = Math.min(end, t + dt / STORY_MS);
    if (!announced && was < at.view && t >= at.view) {
      announced = true;
      announce(story.live.first);
    }
    if (t >= 1) {
      phase = { kind: 'still' };
    }
    render();
    schedule();
  }

  /** Asks for the next frame while the story plays and the picture is on screen. */
  function schedule(): void {
    const end = findEnd();
    if (!frame && end !== undefined && t < end && !offscreen && !document.hidden) {
      frame = requestAnimationFrame(tick);
    }
  }

  /** Stops the frames, for a pause off screen or in a hidden tab. */
  function pause(): void {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  /** A hand on the picture, from a pointer or the keyboard, ends the click by itself for good. */
  function takeHands(): void {
    if (phase.kind === 'auto') {
      phase = t < at.click ? { kind: 'hands-on' } : { kind: 'replay' };
      render();
    }
  }

  /** Moves to `value` and stops there, for a scrub or a key. */
  function seek(value: number): void {
    phase = { kind: 'still' };
    t = clamp(value);
    pause();
    render();
  }

  /** Shows "cached" for a moment: a later click runs code that is already loaded. */
  function showCached(row: HTMLElement): void {
    clearTimeout(hitTimer);
    for (const other of rows) {
      other.classList.remove('is-hit');
    }
    row.classList.add('is-hit');
    cached?.classList.add('is-hit');
    hitTimer = setTimeout(() => {
      row.classList.remove('is-hit');
      cached?.classList.remove('is-hit');
    }, HIT_MS);
  }

  function handleClick(event: Event, index: number): void {
    // Before the loader the page takes no click, and while the loop runs it takes no second one.
    if (t < at.load || (t >= at.click && t < at.patch) || (t < at.click && index !== target)) {
      event.preventDefault();
      return;
    }

    // The first click on the todo runs the loop from the press.
    if (t < at.click) {
      phase = { kind: 'replay' };
      t = at.click - 0.012;
      last = 0;
      render();
      schedule();
      return;
    }

    // A later click flips the row with the chunks already loaded.
    after[index] = !after[index];
    render();
    showCached(rows[index]);
    announce(story.live.later);
  }

  // The rows and the slider take input from now on.
  for (const [index, input] of inputs.entries()) {
    input.disabled = false;
    input.addEventListener('click', (event) => {
      handleClick(event, index);
    });
  }
  stage.addEventListener('focusin', takeHands);
  stage.addEventListener('pointerenter', takeHands);
  stage.addEventListener('pointerdown', takeHands);

  // Scrubbing: drag the knob or the track. The story stays where it is let go.
  function listenScrub(area: HTMLElement): void {
    function readTime(event: PointerEvent): number {
      const rect = area.getBoundingClientRect();
      return rect.width > 0 ? clamp((event.clientX - rect.left) / rect.width) : t;
    }
    function move(event: PointerEvent): void {
      seek(readTime(event));
    }
    function stop(): void {
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerup', stop);
      area.removeEventListener('pointercancel', stop);
    }
    area.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      area.setPointerCapture(event.pointerId);
      knob?.focus({ preventScroll: true });
      seek(readTime(event));
      area.addEventListener('pointermove', move);
      area.addEventListener('pointerup', stop);
      area.addEventListener('pointercancel', stop);
    });
  }
  if (track) {
    listenScrub(track);
  }
  if (knob) {
    knob.disabled = false;
    knob.addEventListener('keydown', (event) => {
      const step = KEY_STEPS.get(event.key);
      if (step !== undefined) {
        event.preventDefault();
        seek(t + step);
      }
    });
  }

  // Pause off screen and in a hidden tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
    } else {
      schedule();
    }
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        offscreen = !entry.isIntersecting;
      }
      if (offscreen) {
        pause();
      } else {
        schedule();
      }
    });
    observer.observe(stage);
  }

  // Move from the still frame the server wrote to the start, in one step with no transition.
  stage.dataset.live = '';
  stage.classList.add('is-snap');
  render();
  stage.getBoundingClientRect();
  stage.classList.remove('is-snap');
  schedule();
}

const stage = document.querySelector<HTMLElement>('[data-hero]');
if (stage) {
  const story: unknown = JSON.parse(stage.dataset.story ?? 'null');
  if (isStory(story)) {
    start(stage, story);
  }
}

// A module, so its declarations stay local to it.
export {};
