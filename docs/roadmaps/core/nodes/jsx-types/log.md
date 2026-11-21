# Log: jsx-types

- Reset to batch/core. `src/core/jsx.ts` is owned by core-api, so `IntrinsicElements` is filled in `src/jsx-runtime/index.ts`, which declares its own `JSX` namespace.
- Window and document use a local event prop type, since `EventProp` requires an `Element`.
