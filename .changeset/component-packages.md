---
'idlip': minor
---

A package can publish idlip components as source. Mark it with `"idlip": { "version": 1, "dir": "src" }` in its `package.json`, and an app that lists the package in `dependencies` or `devDependencies` gets its `.tsx` files compiled by the plugin, in `vite dev` and in a build, with their stylesheets linked. A field with another `version` stops `vite` at startup.
