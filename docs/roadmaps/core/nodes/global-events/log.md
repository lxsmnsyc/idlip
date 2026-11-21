# Log: global-events

- Chose `process.env.NODE_ENV` for the dev flag: Vite defines it in client builds of dependencies too.
- Tests mount through `idlip/testing`. A burst of events before the first chunk resolves exercises `latest:` without a gate.
- Loader size for the todo build: 3913 B.
