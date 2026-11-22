// The landing demo: watches the frame's requests and keeps the frame's theme in step with the
// page.
import { watchFrame } from './lib/network.ts';
import type { NetworkPanel } from './lib/network.ts';

const demo = document.querySelector<HTMLElement>('[data-demo]');
const frame = demo?.querySelector<HTMLIFrameElement>('[data-demo-frame]');

function findPanel(root: HTMLElement): NetworkPanel | undefined {
  const load = root.querySelector<HTMLElement>('[data-net-load]');
  const events = root.querySelector<HTMLElement>('[data-net-events]');
  const loadCode = root.querySelector<HTMLElement>('[data-net-code-load]');
  const eventsCode = root.querySelector<HTMLElement>('[data-net-code-events]');
  if (!load || !events || !loadCode || !eventsCode) {
    return undefined;
  }
  return { load, events, loadCode, eventsCode };
}

/** Gives the frame the theme the page shows, chosen or from the system. */
function syncTheme(target: HTMLIFrameElement): void {
  const root = target.contentDocument?.documentElement;
  const theme = document.documentElement.dataset.theme;
  if (!root) {
    return;
  }
  if (theme === undefined) {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

const panel = demo ? findPanel(demo) : undefined;

if (demo && frame && panel) {
  const target = frame;
  const lists = panel;
  let stop = (): void => {};

  function start(): void {
    stop();
    syncTheme(target);
    stop = watchFrame(target, lists);
  }

  target.addEventListener('load', start);
  if (
    target.contentDocument?.readyState === 'complete' &&
    target.contentWindow?.location.href !== 'about:blank'
  ) {
    start();
  }

  new MutationObserver(() => {
    syncTheme(target);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  demo.querySelector('[data-demo-reload]')?.addEventListener('click', () => {
    target.contentWindow?.location.reload();
  });
}
