/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
import { chunks } from 'virtual:idlip/manifest';
import TodoApp from './todo.idlip.tsx';

// Renders a page that names the chunk URLs of the todo module, as the state
// script of a real render would.
export function render(): string {
  const urls = chunks[TodoApp.id];
  return `<script type="idlip/chunks">${JSON.stringify(urls)}</script>`;
}

export { chunks, TodoApp };
