# Log: testing-mount

- Branch `feat/testing-mount` reset to `batch/core`. Nothing existed under `src/testing`.
- Chunks and the server module run from `data:` URLs. Their `idlip/server` and `idlip/client` imports become reads from an object on `globalThis`, since a data URL cannot resolve a bare import.
- Coordinator update: the source rewrite and the 5 ms quiet-tick wait are gone. The server module takes `model` as a third parameter, and `resume()` returns `{ stop, settled }`.
- `resume()` returns `stop`. Brumate's file was read from `/Users/alexis/Documents/GitHub/brumate`.
