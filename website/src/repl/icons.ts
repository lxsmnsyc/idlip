// The icons of the REPL, in the set of the site: 24px grid, 1.8px stroke.

const OPEN =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const REPL_ICON = {
  plus: `${OPEN}<path d="M12 5v14M5 12h14"/></svg>`,
  close: `${OPEN.replace('width="18" height="18"', 'width="14" height="14"')}<path d="M6 6l12 12M18 6L6 18"/></svg>`,
  play: `${OPEN}<path d="M7 5l12 7-12 7z"/></svg>`,
  link: `${OPEN}<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
  /** Opens the code somewhere else: a box with an arrow out of its corner. */
  external: `${OPEN}<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>`,
  chevron: `${OPEN.replace('width="18" height="18"', 'width="14" height="14"')}<path d="M9 6l6 6-6 6"/></svg>`,
  alert: `${OPEN}<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>`,
};

export default REPL_ICON;
