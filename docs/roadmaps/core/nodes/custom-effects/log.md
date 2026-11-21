# Log: custom-effects

- Filed `contracts/compiled-format-tasks.change-request.md` first, then built against it.
- The splitter handles top-level statements and one `try` level. Each segment function writes `try { ... } catch (e) { ... }` and the code after the `try` itself, so a continuation needs no helper.
- The fixture does not use `Random` from `idlip`, since the package does not export it until `stock-sources` and the typecheck covers `test/fixtures`. Built-in sites are tested with inline sources.
