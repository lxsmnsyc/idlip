// The hero picture. It starts at rest, with no component code loaded, and after a moment clicks
// a checkbox by itself: the two chunks arrive and one row and the count change. The visitor can
// click any checkbox. The first click loads the chunks, every later one is served from the cache.
// With reduced motion, or without this script, the picture stays at its end state.
//
// The picture is at one of two phases. The stylesheet draws both from `--clicked` on the stage.

type Phase = { kind: 'rest' } | { kind: 'loaded' };

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
    if (phase.kind === 'rest') {
      phase = { kind: 'loaded' };
      clearTimeout(restTimer);
      stage.style.setProperty('--clicked', '1');
    } else {
      showCached();
    }
  }

  /** The click the picture makes by itself, on the row the server marked. */
  function clickByItself(): void {
    const input = stage.querySelector<HTMLInputElement>('[data-flip] input');
    if (input) {
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

  for (const input of inputs) {
    input.disabled = false;
  }
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
