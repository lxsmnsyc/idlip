// The icons of the REPL, in the set of the site: 24px grid, 1.8px stroke.

const OPEN =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const REPL_ICON = {
  plus: `${OPEN}<path d="M12 5v14M5 12h14"/></svg>`,
  close: `${OPEN.replace('width="18" height="18"', 'width="14" height="14"')}<path d="M6 6l12 12M18 6L6 18"/></svg>`,
  play: `${OPEN}<path d="M7 5l12 7-12 7z"/></svg>`,
  link: `${OPEN}<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
};

export default REPL_ICON;
