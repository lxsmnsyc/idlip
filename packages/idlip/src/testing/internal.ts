/**
 * Hooks for the repo's own tests. This module is not an entry of the package: `mount` records a
 * driver for each page it returns, and the differential test reads it.
 */
import type { Manifest, Model } from '../core/format.ts';

/** A stateful child that the page renders, found by its model path. */
export interface MountedChild {
  /** The model path of the slot. */
  readonly path: string;
  /** The manifest of the child's component. */
  readonly manifest: Manifest;
  /** The model the page shows for the child now. */
  readonly model: Model;
}

export interface ChildDriver {
  /** The stateful children of the page and the model each shows now. */
  children: () => MountedChild[];
  /**
   * Patches the DOM of a child from the model it shows to `model`, through its chunks, and
   * records the model for the server render of the check. It runs next to the loader, which
   * does not see the change, so the page must not be clicked afterwards.
   */
  patchChild: (path: string, model: Model) => Promise<void>;
}

const drivers = new WeakMap<object, ChildDriver>();

/** Records the driver of a mounted page. */
export function setDriver(page: object, driver: ChildDriver): void {
  drivers.set(page, driver);
}

/** Returns the driver of a page that `mount` made. */
export function getDriver(page: object): ChildDriver {
  const driver = drivers.get(page);
  if (driver === undefined) {
    throw new Error('The page was not made by mount');
  }
  return driver;
}
