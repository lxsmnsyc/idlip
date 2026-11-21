# Log: e2e-harness

- Built `e2e/` with stub listener, loader and client, and a fixture server on the golden todo fixture. 8 tests pass.
- Stubs carry `oxlint-disable` because they are untyped browser JS. The real runtime nodes replace them.
- A Proxy on `self.$idlip` counts state decodes without touching runtime internals.
