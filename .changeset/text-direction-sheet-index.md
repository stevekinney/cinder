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

Only negative results are cached, since a positive one just sends the caller
down the walk it would have run anyway. Three kinds of sheet opt out of negative
caching rather than risk a stale skip: constructed stylesheets (no `ownerNode`),
because `replace()`/`replaceSync()` throw on anything else and so those are
exactly the sheets whose contents can be swapped without the rule count moving;
sheets containing `@import`, whose imported sheet can gain rules asynchronously;
and sheets whose CSSOM is unreadable, which are reported as "declares direction"
so the caller still runs its own guarded walk.

Two mutations on a non-constructed sheet remain invisible to a rule-count key:
an in-place declaration edit (`rule.style.direction = 'rtl'`), and a
`deleteRule`/`insertRule` pair between two queries that lands on the same count.
Both are covered by `invalidatePortalDirection()` — the existing public hook for
"a CSSOM edit that emits no DOM mutation" — which now clears this index
unconditionally, including when no portal is currently observing direction.

Resolves stevekinney/cinder#1262.
