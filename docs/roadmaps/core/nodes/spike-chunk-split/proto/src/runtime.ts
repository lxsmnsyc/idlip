/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
// Stands in for `idlip/client`: the code that every chunk calls.
export function setText(node: Node, value: unknown): void {
  node.textContent = String(value);
}

export function setProperty(node: Element, name: string, value: unknown): void {
  Reflect.set(node, name, value);
}

export const Random = {
  id(): string {
    return Math.random().toString(36).slice(2);
  },
};
