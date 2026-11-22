import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSTALL_COMMANDS, renderInstall } from '../src/landing/install.ts';

interface FakeTab {
  id: string;
  dataset: Record<string, string>;
  attrs: Record<string, string>;
  tabIndex: number;
  focused: boolean;
  setAttribute: (name: string, value: string) => void;
  focus: () => void;
  closest: (selector: string) => unknown;
}

type Listener = (event: unknown) => void;

interface FakePage {
  listeners: Record<string, Listener>;
  panel: { id: string; textContent: string; attrs: Record<string, string> };
  copy: { dataset: { copy: string } };
  tabs: FakeTab[];
  store: Record<string, string>;
}

/** One tab group and the document around it, enough for `install.ts`. */
function makePage(saved: string | undefined, blocked: boolean): FakePage {
  const listeners: Record<string, Listener> = {};
  const panel = {
    id: 'install-hero-panel',
    textContent: '',
    attrs: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this.attrs[name] = value;
    },
  };
  const copy = { dataset: { copy: 'pnpm add idlip' } };
  const tabs: FakeTab[] = [];
  const list = { querySelectorAll: () => tabs };
  for (const item of INSTALL_COMMANDS) {
    const tab: FakeTab = {
      id: `install-hero-${item.manager}`,
      dataset: { manager: item.manager, command: item.command },
      attrs: {},
      tabIndex: -1,
      focused: false,
      setAttribute(name, value) {
        this.attrs[name] = value;
      },
      focus() {
        this.focused = true;
      },
      closest(selector) {
        if (selector === '.install-tab') {
          return this;
        }
        return selector === '[role="tablist"]' ? list : null;
      },
    };
    tabs.push(tab);
  }
  const group = {
    querySelectorAll: () => tabs,
    querySelector: (selector: string) => (selector === '.install-command' ? panel : copy),
  };
  const store: Record<string, string> = saved === undefined ? {} : { 'package-manager': saved };
  vi.stubGlobal('localStorage', {
    getItem: (key: string): string | null => {
      if (blocked) {
        throw new Error('Storage is blocked');
      }
      return store[key] ?? null;
    },
    setItem: (key: string, value: string): void => {
      if (blocked) {
        throw new Error('Storage is blocked');
      }
      store[key] = value;
    },
  });
  vi.stubGlobal('Element', Object);
  vi.stubGlobal('document', {
    querySelectorAll: () => [group],
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
  });
  return { listeners, panel, copy, tabs, store };
}

async function load(saved?: string, blocked = false): Promise<FakePage> {
  const page = makePage(saved, blocked);
  vi.resetModules();
  await import('../src/client/install.ts');
  return page;
}

describe('the install tabs markup', () => {
  const html = renderInstall('hero');

  it('writes pnpm active and the command as plain text', () => {
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true" tabindex="0" data-manager="pnpm"');
    expect(html).toContain('aria-selected="false" tabindex="-1" data-manager="npm"');
    expect(html).toContain('>pnpm add idlip</code>');
    // Each tab controls the one panel, which a keyboard user can reach.
    expect(html.match(/aria-controls="install-hero-panel"/g)).toHaveLength(4);
    expect(html).toContain('id="install-hero-panel" role="tabpanel" tabindex="0"');
    expect(html).toContain('data-copy="pnpm add idlip"');
  });

  it('has a tab for pnpm, npm, yarn and bun', () => {
    for (const manager of ['pnpm', 'npm', 'yarn', 'bun']) {
      expect(html).toContain(`data-manager="${manager}"`);
    }
  });
});

describe('the install tabs script', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('switches the command and the text the copy button copies', async () => {
    const page = await load();
    page.listeners.click({ target: page.tabs[1] });
    expect(page.panel.textContent).toBe('npm install idlip');
    expect(page.copy.dataset.copy).toBe('npm install idlip');
    expect(page.tabs[1].attrs['aria-selected']).toBe('true');
    expect(page.tabs[0].attrs['aria-selected']).toBe('false');
    expect(page.tabs[1].tabIndex).toBe(0);
    expect(page.store['package-manager']).toBe('npm');
  });

  it('moves between tabs with the arrow keys, wrapping around', async () => {
    const page = await load();
    const press = (key: string, from: number): { preventDefault: ReturnType<typeof vi.fn> } => {
      const event = { target: page.tabs[from], key, preventDefault: vi.fn() };
      page.listeners.keydown(event);
      return event;
    };
    expect(press('ArrowRight', 0).preventDefault).toHaveBeenCalled();
    expect(page.tabs[1].focused).toBe(true);
    expect(page.copy.dataset.copy).toBe('npm install idlip');
    press('ArrowLeft', 0);
    expect(page.copy.dataset.copy).toBe('bun add idlip');
    expect(press('a', 0).preventDefault).not.toHaveBeenCalled();
  });

  it('jumps to the first tab on Home and the last on End', async () => {
    const page = await load();
    const event = { target: page.tabs[2], key: 'Home', preventDefault: vi.fn() };
    page.listeners.keydown(event);
    expect(page.copy.dataset.copy).toBe('pnpm add idlip');
    expect(page.tabs[0].focused).toBe(true);
    page.listeners.keydown({ target: page.tabs[0], key: 'End', preventDefault: vi.fn() });
    expect(page.copy.dataset.copy).toBe('bun add idlip');
    expect(page.tabs[3].focused).toBe(true);
    expect(page.tabs[3].attrs['aria-selected']).toBe('true');
  });

  it('keeps aria-controls and aria-labelledby in step with the panel', async () => {
    const page = await load();
    page.listeners.click({ target: page.tabs[2] });
    for (const tab of page.tabs) {
      expect(tab.attrs['aria-controls']).toBe('install-hero-panel');
    }
    expect(page.panel.attrs['aria-labelledby']).toBe('install-hero-yarn');
  });

  it('still switches when storage is blocked', async () => {
    const page = await load(undefined, true);
    expect(() => {
      page.listeners.click({ target: page.tabs[3] });
    }).not.toThrow();
    expect(page.panel.textContent).toBe('bun add idlip');
    expect(page.store).toEqual({});
  });

  it('restores the choice of an earlier visit', async () => {
    const page = await load('yarn');
    expect(page.panel.textContent).toBe('yarn add idlip');
    expect(page.copy.dataset.copy).toBe('yarn add idlip');
  });
});
