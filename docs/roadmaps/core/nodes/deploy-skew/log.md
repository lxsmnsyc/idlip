# Log: deploy-skew

- First version fetched the page to learn the build. The e2e CSP blocked it, so the loader imports build.js instead.
- Loader sizes (gzip -9): base 3919, skew off 3919, skew on 4085.
- Review: moved the build check out of the loader into build.js (+166 B to +60 B). The trigger is the final failure in load.
