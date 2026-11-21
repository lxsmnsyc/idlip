/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
export async function saveTodos(todos: unknown): Promise<void> {
  await fetch('/api/todos', { method: 'POST', body: JSON.stringify(todos) });
}
