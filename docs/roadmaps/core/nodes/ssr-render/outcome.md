# Outcome: ssr-render

## Built

- `packages/idlip/src/server/helpers.ts`: `text`, `attr`, `on` by the Values and Events rules of `contracts/compiled-format.md`.
- `packages/idlip/src/server/render.ts`: `render(component, props, { nonce })`. It calls the compiled default export with a `RenderContext`, takes the one `context.state` call, and appends `<script i-state>` with the seroval record `["<events>",()=>(<state>)]`. `PageState.chunks` is whatever the module passes, which is only its own entries.
- `packages/idlip/src/server/index.ts`: exports `render`, `attr`, `on`, `text`. `renderListener` is left to `resume-loader`.
- `packages/idlip/test/server/render.test.ts`: 7 tests.

## Acceptance

- Both fixtures render to `expected/page.html` (the compiled `server.js` runs against the real helpers): pass.
- A model string with `</script>`, `<!--`, `"`, U+2028 and `&`: text and attributes escaped, the script has one closing tag, no `<!--`, no raw U+2028, and the state decodes back to the string: pass.
- `nonce` is written as `<script i-state nonce="…">`, escaped: pass. `render()` output has no other inline script.
- `pnpm --filter idlip test`: 181 passed (8 files).

## Deviations

None outside owned paths.

## Gotchas

- `render` throws if the component records state zero times or twice. Nested components will need several records (`nesting`).
- Attribute values do not escape `<`, as the contract says. A quoted attribute holds it safely.
- Review fixes: seroval runs with `Feature.ErrorPrototypeStack` disabled. A value that does not serialize throws a `TypeError` naming its `model.` or `props.` path, found by walking the values. The events string escapes `<`, U+2028 and U+2029.

## Verification

- `pnpm --filter idlip exec vitest run test/server`: 7 passed.
- `pnpm format:check`: passes. `oxlint --type-aware` on the owned paths: clean.

## Size

Estimated M, actual S.
