/**
 * Runs `read` on a proxy of the model and stores the paths it read in `store[name]`. Every own
 * field read on a plain object or an array is a path, and an array index reads as `*`, so the
 * paths match the manifest's form. A path that starts a longer one was only read on the way to
 * it, so it is dropped. The server and a client chunk run this function: the compiler copies it
 * into the chunk, so it uses no outside names, holds no comment in its body and has the `$`
 * suffix of the other helpers (see `core/helpers.ts`). `in`, `Object.keys` and a spread record
 * `<path>.*`, so a key added later counts as a change. A record read by many keys records one
 * path per key, so its entry in the page state grows with them.
 */
// oxlint-disable-next-line import/prefer-default-export
export function track$(
  store: Record<string, string[]> | undefined,
  name: string,
  model: object,
  read: (model: unknown) => unknown,
): unknown {
  const seen = new Set<string>();
  function wrap(value: unknown, path: string): unknown {
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    const proto: unknown = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
      return value;
    }
    return new Proxy(value, {
      get(target, key, receiver) {
        const result: unknown = Reflect.get(target, key, receiver);
        if (typeof key !== 'string' || !Object.hasOwn(target, key)) {
          return result;
        }
        const field = Array.isArray(target) && key !== 'length' ? '*' : key;
        const next = path === '' ? field : `${path}.${field}`;
        seen.add(next);
        return wrap(result, next);
      },
      has(target, key) {
        if (path !== '') {
          seen.add(`${path}.*`);
        }
        return Reflect.has(target, key);
      },
      ownKeys(target) {
        if (path !== '') {
          seen.add(`${path}.*`);
        }
        return Reflect.ownKeys(target);
      },
    });
  }
  const result = read(wrap(model, ''));
  if (store !== undefined) {
    const paths: string[] = [];
    for (const path of seen) {
      let inner = false;
      for (const other of seen) {
        if (other.startsWith(`${path}.`)) {
          inner = true;
          break;
        }
      }
      if (!inner) {
        paths.push(path);
      }
    }
    store[name] = paths.toSorted();
  }
  return result;
}
