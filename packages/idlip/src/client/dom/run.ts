// oxlint-disable import/prefer-default-export
import { callDom } from '../../core/dom.ts';
import type { After, Page } from '../../core/format.ts';

/** Runs the Dom calls a batch collected, under the page's root. Call it after the patch. */
export function runAfter(page: Page, calls: readonly After[]): void {
  for (const { call, args } of calls) {
    callDom(page.root, call, args[0]);
  }
}
