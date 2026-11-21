import './jsx';
declare function Subscribe<I, V>(props: { to: (input: I, signal: AbortSignal) => AsyncIterable<V>; input: I; 'on:value': (value: V) => unknown }): JSX.Element;
declare function Try(props: { catch: (error: unknown, reset: () => void) => JSX.Element; children: JSX.Element }): JSX.Element;
async function* every(ms: number) { while (true) { await new Promise((r) => setTimeout(r, ms)); yield Date.now(); } }
async function* socket(url: string, signal: AbortSignal) { yield `${url}${signal.aborted}`; }
export function C() {
  function tick(now: number) { return now; }
  function got(text: string) { return text; }
  return (
    <main>
      <Subscribe to={every} input={1000} on:value={tick} />
      <Subscribe to={socket} input="wss://x" on:value={got} />
      {/* @ts-expect-error wrong arg type */}
      <Subscribe to={every} input="1000" on:value={tick} />
      {/* @ts-expect-error value type mismatch */}
      <Subscribe to={socket} input="wss://x" on:value={tick} />
      <Try catch={(error, reset) => <button on:click={reset}>{String(error)}</button>}><p>x</p></Try>
    </main>
  );
}
