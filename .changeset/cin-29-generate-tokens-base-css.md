---
'@lostgradient/cinder': patch
---

`src/styles/tokens-base.css` is now generated from the DTCG token corpus at `src/tokens/` (`bun run --filter=@lostgradient/cinder tokens:generate`) instead of hand-authored, and `tokens:check` (corpus validation plus a generator drift check) replaces the bare `tokens:validate` step in `lint:invariants`. Also adds `src/tokens/resolved/{light,dark,light-reduced-motion,dark-reduced-motion}.json`, fully resolved per-context token snapshots derived from `cinder.resolver.json`. No declaration in `tokens-base.css` changed value — this is a packaging/authoring change, not a design change — but the shipped file's bytes differ (declaration order and comment placement), which is why the published package version moves even though every token value is unchanged.
