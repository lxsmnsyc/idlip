# Log: resume-loader

- Brief says the loader delegates events. The contract gives that to the early listener (`renderListener`) and has the loader take over its queue. Built to the contract: delegation lives in `src/client/loader/listener.ts`, the loader is `loader/resume.ts`.
- `renderListener` is re-exported from `src/server/index.ts` (one-line deviation).
- Rebased onto `batch/core` after the first commit: the real patcher is wired and the stub is deleted. Loader gzip is 3811 B fully minified (an unminified library build showed 4407 B).
- Vitest's module runner caches a failed import. The retry is tested with a chunk that throws until `restore`, and the loader retries with `#<n>` appended to the URL. Browsers may also keep a failed dynamic import.
- Test chunk copies live in `node_modules/.idlip-loader-test/`, because the module runner cannot import from the system temp folder.
- Listener gzip is 974 B with the script tags.
