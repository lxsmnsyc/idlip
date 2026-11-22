// The hero picture. It starts at rest, with no component code loaded, and after a moment clicks
// a checkbox by itself: the two chunks arrive and one row and the count change. The visitor can
// click any checkbox. The first click loads the chunks, every later one is served from the cache.
// With reduced motion, or without this script, the picture stays at its end state.
//
// The picture is at one of three phases. The stylesheet draws them from `--clicked` on the stage.
// The picture is a model: no request is made.

type Phase =
  // Nothing loaded yet, and the picture will click by itself.
  | { kind: 'rest' }
  // Nothing loaded yet, and the visitor has a hand on it, so it never clicks by itself.
  | { kind: 'hands-on' }
  // The chunks are loaded. Later clicks are served from the cache.
  | { kind: 'loaded' };

/** How long the picture rests before the first click, in milliseconds. */
const REST_MS = 1600;

/** How long the "cached" mark shows after a later click, in milliseconds. */
const HIT_MS = 1200;

function start(stage: HTMLElement): void {
  const inputs = stage.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let phase: Phase = reduced ? { kind: 'loaded' } : { kind: 'rest' };
  let restTimer: ReturnType<typeof setTimeout> | undefined;
  let hitTimer: ReturnType<typeof setTimeout> | undefined;
  let visible = true;

  /** Writes a row's done state and the count of todos left. */
  function showToggle(input: HTMLInputElement): void {
    input.closest<HTMLElement>('.hero-row')?.style.setProperty('--done', input.checked ? '1' : '0');
    let left = 0;
    for (const other of inputs) {
      if (!other.checked) {
        left++;
      }
    }
    const count = stage.querySelector('[data-left]');
    if (count) {
      count.textContent = String(left);
    }
  }

  /** Says what happened in the live line, for screen readers. */
  function announce(key: 'first' | 'later'): void {
    const live = stage.querySelector<HTMLElement>('[data-hero-live]');
    if (live) {
      live.textContent = live.dataset[key] ?? '';
    }
  }

  /** Shows "cached" on the loaded chunks for a moment: the click fetched nothing. */
  function showCached(): void {
    clearTimeout(hitTimer);
    for (const hit of stage.querySelectorAll('.hero-hit')) {
      hit.classList.add('is-hit');
    }
    hitTimer = setTimeout(() => {
      for (const hit of stage.querySelectorAll('.hero-hit')) {
        hit.classList.remove('is-hit');
      }
    }, HIT_MS);
  }

  function handleToggle(input: HTMLInputElement): void {
    showToggle(input);
    if (phase.kind === 'loaded') {
      showCached();
      announce('later');
    } else {
      phase = { kind: 'loaded' };
      clearTimeout(restTimer);
      stage.style.setProperty('--clicked', '1');
      announce('first');
    }
  }

  /** The click the picture makes by itself, on the row the server marked. */
  function clickByItself(): void {
    const input = stage.querySelector<HTMLInputElement>('[data-flip] input');
    if (phase.kind === 'rest' && input) {
      input.checked = !input.checked;
      handleToggle(input);
    }
  }

  /** Waits to click while the picture is on screen and at rest. */
  function schedule(): void {
    clearTimeout(restTimer);
    if (phase.kind === 'rest' && visible) {
      restTimer = setTimeout(clickByItself, REST_MS);
    }
  }

  /** A hand on the picture, from a pointer or the keyboard, ends the click by itself for good. */
  function takeHands(): void {
    if (phase.kind === 'rest') {
      phase = { kind: 'hands-on' };
      clearTimeout(restTimer);
    }
  }

  for (const input of inputs) {
    input.disabled = false;
  }
  stage.addEventListener('focusin', takeHands);
  stage.addEventListener('pointerenter', takeHands);
  stage.addEventListener('pointerdown', takeHands);
  stage.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement) {
      handleToggle(event.target);
    }
  });

  if (phase.kind === 'rest') {
    // Move from the end state the server wrote to the state at rest, in one step.
    const flip = stage.querySelector<HTMLElement>('[data-flip]');
    const input = flip?.querySelector('input');
    const rest = flip?.style.getPropertyValue('--rest') ?? '';
    if (flip && input) {
      input.checked = rest === '1';
      flip.style.setProperty('--done', rest);
    }
    stage.dataset.live = '';
    stage.style.setProperty('--clicked', '0');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          visible = entry.isIntersecting;
        }
        schedule();
      });
      observer.observe(stage);
    }
    schedule();
  }
}

const stage = document.querySelector<HTMLElement>('[data-hero]');
if (stage) {
  start(stage);
}

// A module, so its declarations stay local to it.
export {};
