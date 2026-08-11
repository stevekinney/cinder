---
'@lostgradient/cinder': patch
---

perf(text-direction): skip stylesheets that declare no `direction` before walking them

Every component that resolves text direction — `Dropdown.Menu`, `DropdownMenu`,
`ContextMenu`, `CommandMenu`, `MegaMenu`, `MenuBar`, `Slider` — walked every CSS
rule in every stylesheet in the document, per element, per ancestor, per call,
with no memoization at any layer: `resolveTextDirection` allocates a fresh
`WeakMap` on each call and `elementDirectionStyleOverride` passes none at all.

Measured in a consuming app, a single `Dropdown` mount walked a 179-sheet /
7651-rule document about 42 times — 7518 `sheet.cssRules` reads plus 44184
nested reads, ~370ms of blocking main-thread time, 74% of all sampled CPU — to
answer a question whose answer was `false` for every element, because that app's
CSS contains no `direction` declarations at all. The cost scaled linearly with
CPU, so on a loaded machine it delayed first paint of the tab that mounted the
dropdown past five seconds.

`matchesDirectionStyleRule` has exactly one way to return `true`: a style rule
whose `style.direction` is truthy and whose selector matches. A stylesheet that
declares `direction` nowhere in its rule tree therefore cannot contribute a
match, and skipping it is behavior-preserving by construction. A new per-sheet
index answers that question once and caches it, keyed by stylesheet and
validated against the sheet's top-level rule count.

The index is deliberately permissive: unreadable (cross-origin) CSSOM reports
"declares direction" so the caller still runs its own guarded walk, and a
negative result is not cached for a sheet containing `@import`, whose imported
sheet can gain rules asynchronously without changing its importer's rule count.
`resetDirectionStyleSheetIndex()` is exported for consumers that edit CSSOM
declarations in place, which is the one mutation a rule-count key cannot see.

No behavior change; resolves stevekinney/cinder#1262.
