// The install command with tabs for the package managers. The server writes the pnpm tab as the
// active one and the command as plain text. `src/client/install.ts` makes the tabs work.
import { escape } from '../layout.ts';

/** The package managers, in tab order, with the command each one runs. */
export const INSTALL_COMMANDS: readonly { manager: string; command: string }[] = [
  { manager: 'pnpm', command: 'pnpm add idlip' },
  { manager: 'npm', command: 'npm install idlip' },
  { manager: 'yarn', command: 'yarn add idlip' },
  { manager: 'bun', command: 'bun add idlip' },
];

/** The install tabs and the copy button. `place` keeps the ids unique when the page has two. */
export function renderInstall(place: string): string {
  let tabs = '';
  for (const [index, item] of INSTALL_COMMANDS.entries()) {
    const active = index === 0;
    tabs += `<button class="install-tab" type="button" role="tab" id="install-${place}-${item.manager}" aria-controls="install-${place}-panel" aria-selected="${active}" tabindex="${active ? 0 : -1}" data-manager="${item.manager}" data-command="${escape(item.command)}">${item.manager}</button>`;
  }
  const [first] = INSTALL_COMMANDS;
  return `<div class="install" data-install>
  <div class="install-tabs" role="tablist" aria-label="Package manager">${tabs}</div>
  <div class="install-line"><code class="install-command" id="install-${place}-panel" role="tabpanel" tabindex="0" aria-labelledby="install-${place}-${first.manager}">${escape(first.command)}</code><button class="code-copy" type="button" data-copy="${escape(first.command)}" aria-label="Copy the install command">Copy</button></div>
</div>`;
}
