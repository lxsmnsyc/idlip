// @vitest-environment happy-dom
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBuildSource } from '../../src/vite/skew.ts';

interface BuildModule {
  default: string;
  check: () => void;
}

/** Runs `build.js` of a server that runs build `id`, with its exports turned into a result. */
function importBuild(id: string): BuildModule {
  const body = getBuildSource(id)
    .replace('export default', 'const id =')
    .replace('export function', 'function');
  const globals = { document, sessionStorage, location: globalThis.location, JSON };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return runInNewContext(`${body}\n({ default: id, check })`, globals) as BuildModule;
}

describe('build.js check', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '<script i-state i-build="old00000"></script>';
    reload = vi.fn();
    vi.stubGlobal('location', { href: 'http://localhost/', reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports the build id', () => {
    expect(importBuild('new00000').default).toBe('new00000');
  });

  it('reloads once when the server runs another build, and not again', () => {
    const build = importBuild('new00000');
    build.check();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('idlip:builds')).toBe('{"old00000":"reloaded"}');
    // The cache serves the old page again: the tab stays on it.
    build.check();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the server runs the same build', () => {
    importBuild('old00000').check();
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('idlip:builds')).toBeNull();
  });

  it('does nothing without a build id on the page', () => {
    document.body.innerHTML = '<script i-state></script>';
    importBuild('new00000').check();
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps the state of each build apart', () => {
    importBuild('new00000').check();
    document.body.innerHTML = '<script i-state i-build="older000"></script>';
    importBuild('new00000').check();
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
