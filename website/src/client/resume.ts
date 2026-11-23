// The resume diagram. The stage's `data-step` drives every visual state in CSS, so a change of
// step is a set of CSS transitions that reverse from wherever they are. On a wide and tall
// screen the page scroll moves the steps too.

import { formatBytes } from '../landing/format.ts';

const STEPS = 4;
/** How long a step jump may scroll before the page scroll drives the steps again. */
const JUMP_MS = 1500;
const COUNT_MS = 220;

const track = document.querySelector<HTMLElement>('[data-resume]');
const stage = track?.querySelector<HTMLElement>('.resume-stage');

/** The value a counter shows now, which a new step counts on from. */
const shown = new WeakMap<HTMLElement, number>();
const frames = new WeakMap<HTMLElement, number>();

function formatCounter(value: number, format: string | undefined): string {
  const whole = Math.round(value);
  return format === 'bytes' ? formatBytes(whole) : String(whole);
}

/** Counts a counter from the value it shows to its value at a step. */
function countTo(counter: HTMLElement, step: number, instant: boolean): void {
  const values = (counter.dataset.values ?? '').split(',');
  const target = Number(values[step - 1] ?? 0);
  const from = shown.get(counter) ?? Number(values[0] ?? 0);
  cancelAnimationFrame(frames.get(counter) ?? 0);

  // Reduced motion or no change: show the value at once.
  if (instant || from === target) {
    shown.set(counter, target);
    counter.textContent = formatCounter(target, counter.dataset.format);
    return;
  }

  // Ease out from the shown value, so a reversed step counts back from where it is.
  const start = performance.now();
  function tick(now: number): void {
    const t = Math.min(1, (now - start) / COUNT_MS);
    const value = from + (target - from) * (1 - (1 - t) ** 3);
    shown.set(counter, value);
    counter.textContent = formatCounter(value, counter.dataset.format);
    if (t < 1) {
      frames.set(counter, requestAnimationFrame(tick));
    }
  }
  frames.set(counter, requestAnimationFrame(tick));
}

function isReduced(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showStep(root: HTMLElement, step: number): void {
  if (root.dataset.step === String(step)) {
    return;
  }
  root.dataset.step = String(step);

  // The tabs and the arrows follow the step.
  for (const tab of root.querySelectorAll<HTMLElement>('[data-go]')) {
    if (tab.dataset.go === String(step)) {
      tab.setAttribute('aria-current', 'step');
    } else {
      tab.removeAttribute('aria-current');
    }
  }
  // One live element announces the sentence of the step.
  const live = root.querySelector<HTMLElement>('[data-says-live]');
  const sentence = root.querySelector<HTMLElement>(`.resume-says [data-at="${step}"]`);
  if (live && sentence) {
    live.textContent = sentence.textContent;
  }

  const previous = root.querySelector<HTMLButtonElement>('[data-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-next]');
  if (previous && next) {
    previous.disabled = step === 1;
    next.disabled = step === STEPS;
  }

  // The counters count to the values of the step.
  for (const counter of root.querySelectorAll<HTMLElement>('[data-values]')) {
    countTo(counter, step, isReduced());
  }
}

/** The height the sticky stage stays put for, per step. */
function getSegment(): number {
  return window.innerHeight * 0.55;
}

/** Whether the page scroll drives the steps: a wide, tall screen and motion allowed. */
function canScroll(root: HTMLElement): boolean {
  const header = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 5;
  return (
    !isReduced() &&
    matchMedia('(min-width: 70rem)').matches &&
    root.offsetHeight <= window.innerHeight - header
  );
}

function getTop(element: HTMLElement): number {
  return element.getBoundingClientRect().top + window.scrollY;
}

if (track && stage) {
  const root = stage;
  const container = track;

  // How far the sticky stage has travelled in its track: 0 when it docks, then one segment per step.
  function getTravel(): number {
    const docked = Number.parseFloat(getComputedStyle(root).top);
    return window.scrollY + docked - getTop(container);
  }

  // While a step jump scrolls the page, the scroll passes the steps between: ignore them. The
  // timer is the state of the jump, cleared on `scrollend` or when it runs out.
  let jump: number | undefined;

  function endJump(): void {
    clearTimeout(jump);
    jump = undefined;
    readScroll();
  }

  function readScroll(): void {
    if (jump === undefined && container.classList.contains('is-scrolling')) {
      const step = Math.floor(getTravel() / getSegment()) + 1;
      showStep(root, Math.min(STEPS, Math.max(1, step)));
    }
  }

  // Scroll mode needs the stage's height for the track. A resize sets it again.
  function setMode(): void {
    container.classList.remove('is-scrolling');
    if (canScroll(root)) {
      container.style.setProperty('--stage-height', `${root.offsetHeight}px`);
      container.classList.add('is-scrolling');
      readScroll();
    }
  }

  function goTo(step: number): void {
    const target = Math.min(STEPS, Math.max(1, step));
    if (container.classList.contains('is-scrolling')) {
      // In scroll mode a step is a place on the page: scroll to the start of its segment.
      const y = window.scrollY - getTravel() + (target - 1) * getSegment() + 2;
      clearTimeout(jump);
      jump = window.setTimeout(endJump, JUMP_MS);
      window.addEventListener('scrollend', endJump, { once: true });
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    showStep(root, target);
  }

  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const tab = event.target.closest<HTMLElement>('[data-go]');
    const current = Number(root.dataset.step);
    if (tab) {
      goTo(Number(tab.dataset.go));
    } else if (event.target.closest('[data-prev]')) {
      goTo(current - 1);
    } else if (event.target.closest('[data-next]')) {
      goTo(current + 1);
    }
  });

  // Left and right arrows move between steps while focus is in the bar.
  root.addEventListener('keydown', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.resume-bar')) {
      return;
    }
    const current = Number(root.dataset.step);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(current + (event.key === 'ArrowRight' ? 1 : -1));
      root.querySelector<HTMLElement>(`[data-go="${root.dataset.step}"]`)?.focus();
    }
  });

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', setMode);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', setMode);
  setMode();
}
