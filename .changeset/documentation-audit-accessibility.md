---
'@lostgradient/cinder': minor
---

Backfill missing component accessibility documentation, gate `.a11y.md` presence in `components:check`, and tighten DataGrid/DataTable audit fixes.

DataGrid columns can now opt into `role="rowheader"` with `rowHeader: true`, virtualized-column overflow keeps a stable gutter and edge cue, and DataTable sortable headers describe the next sort action while focused rows receive the same hover affordance. The package also normalizes optional Svelte component function parameters so packed source remains valid for downstream SvelteKit consumers.
