---
'idlip': minor
---

Stylesheets that components import now reach the page. `import './todo.css'` and CSS Modules (`import styles from './todo.module.css'`) work in a build and in `vite dev`: the server links every stylesheet that the root component's imports reach in `<head>`, before the preload links, with the nonce. `csp: true` adds `style-src 'self'` and the nonce. `RenderResult` has a new `styles` field.
