// The functions that `effects.idlip.tsx` awaits. The fixture compiles and renders without them.

export interface SavedTodo {
  id: string;
  text: string;
  done: boolean;
}

export async function makeId(): Promise<string> {
  const response = await fetch('/api/id');
  return response.text();
}

export async function saveTodos(todos: readonly SavedTodo[]): Promise<void> {
  await fetch('/api/todos', { method: 'PUT', body: JSON.stringify(todos) });
}

export async function loadLabel(prefix: string, count: number): Promise<string> {
  const response = await fetch(`/api/label/${prefix}/${count}`);
  return response.text();
}
