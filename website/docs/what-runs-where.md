---
title: What runs where
order: 16
section: Guide
description: Which code runs on the server and which in the browser, how data crosses, and what fails the build.
---

A component runs once, on the server. The browser gets the HTML and the values that the code of the user's actions needs, and nothing else. This page says which code runs where.

## The server renders, the browser resumes

- The server runs the body of each component and renders the page with the values it computed.
- The browser loads a small loader. No component runs again to rebuild what the server rendered.
- When the user acts, the loader fetches the chunk for that action: a handler, plus the bindings whose model paths changed.

So the body of a component is server code. A `console.log` at the top of a component prints in the terminal of the server.

## Client chunks

Code runs in the browser only when a chunk holds it:

- A handler, a function declaration that an event or a subscription calls.
- A binding or a list item: the code that updates a hole when its model paths change.
- A derived `const` that a binding reads.
- The view of a child component that the browser renders again.

A chunk holds the module-level imports and bindings that this code uses. Everything else stays on the server.

## Data crosses as props and model

The only way a value gets from the server to the browser is the model, which holds your `let` state and props, and which is plain data. Read a secret or a file in the component body, and pass the result in as a prop or a `let`. Do not import the secret into code that a handler or a binding runs.

## What fails the build

The build fails in two cases. `vite dev` fails when the chunk is first requested.

- A client chunk reaches a Node.js module, whether in your own files or in a package: a `node:` import, or a bare name such as `fs` that Vite resolves to its browser stub. A bare name that resolves to an installed package, such as `events` or `buffer`, is fine.
- A client chunk reads `import.meta.env.KEY` where `KEY` does not start with the `envPrefix` of Vite (`VITE_` by default). `MODE`, `DEV`, `PROD`, `SSR` and `BASE_URL` are allowed. In the browser such a key is `undefined`, so this catches a bug: the value never ships.

The error names the chain, from the component and its chunk through each import to the cause:

```
idlip: the client chunk handler=add of /src/app.tsx imports a Node.js module: /src/app.tsx > handler=add > /src/db.ts > node:fs.
```

Code that only the server render reaches is not checked: the body of a component outside its handlers and bindings, and the entry. A component may import `node:fs` and read a file there.

A build checks the code that stays in the chunk after unused code is removed, so a server-only function in a shared file that no chunk calls passes. `vite dev` has no such step. It follows the imports of your own files, so it can report an import that a build would remove, and it does not look into packages. Run a build to be sure.

## Server functions

A marker for a function that only runs on the server, `'use server'`, comes with server functions in a later release. There is no `.server.ts` naming convention. The two checks above catch the mistakes that a marker would not.
