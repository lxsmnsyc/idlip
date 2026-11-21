declare function Subscribe<I, V>(props: { to: (input: I, signal: AbortSignal) => AsyncIterable<V>; input: I; 'on:value': (value: V) => unknown }): unknown;
async function* ws(url: string, protocols?: string[]) { yield url; }
async function* pair(a: string, b: number) { yield a; }
export function C() {
  function got(t: string) { return t; }
  Subscribe({ to: ws, input: 'x', 'on:value': got });
  Subscribe({ to: pair, input: 'x', 'on:value': got });
  Subscribe({ to: async function*(i: number){ yield new MessageEvent('m'); }, input: 1, 'on:value': (e: MessageEvent) => 0 });
}
