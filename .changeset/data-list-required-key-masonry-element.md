---
'@lostgradient/cinder': minor
---

**Breaking: `DataList` now requires a `key` extractor.** `DataListProps.key` was
optional and silently fell back to an unkeyed `{#each}` block when omitted, which
made a stable data-display primitive use index-based reconciliation for mutable
lists (O(n) row churn and incorrect row instance reuse on insert/remove/filter/
reorder). `key` is now required and the unkeyed fallback is removed. Consumers
that omitted `key` must pass a stable extractor, e.g. `key={(item) => item.id}`.

**Breaking: `Masonry.as` is narrowed to a layout-safe element union.** `as` was
typed as any `string`, allowing void elements (`img`, `input`, `br`, `hr`) that
cannot validly contain masonry children. It now accepts a `MasonryElement` union
(`article | aside | div | footer | header | main | nav | section | ul | ol`).
