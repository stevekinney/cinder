---
'@lostgradient/cinder': patch
---

Fix a `hydration_mismatch` warning on the first SSR load of any Cinder component that renders an icon (including Chat, which renders one unconditionally in its composer toolbar).

`lucide-svelte` was a loosely-ranged (`>=0.400.0 <1`) `peerDependency`. Cinder's prebuilt server bundle (`dist/server`, resolved via the `node` export condition under SSR) bakes in whatever `lucide-svelte` version was installed in Cinder's own build at publish time. A consuming application's client bundle, however, resolves `lucide-svelte` fresh at whatever version its own package manager picked within that peer range. Lucide periodically redraws icon artwork (different `<path>` counts or coordinates for the same icon name), so any consumer whose installed `lucide-svelte` differs from Cinder's build-time version got structurally different icon markup between the server-rendered HTML and the client's hydrated render — a real, reproducible `[svelte] hydration_mismatch`, confirmed against a real SvelteKit dev server and a real browser.

`lucide-svelte` is now a pinned, exact-version regular `dependency` of `@lostgradient/cinder` instead of a peer. This guarantees the same `lucide-svelte` version renders identical icon markup on both the server and the client, regardless of what version (if any) your own application installs for its own icons.

**Consumer impact:** if your app currently lists `lucide-svelte` as a direct dependency solely to satisfy `@lostgradient/cinder`'s former peer requirement, you can remove it — Cinder now supplies its own pinned copy for its own components. If your app also renders Lucide icons directly, keep your own dependency; npm/bun will install and resolve it independently of Cinder's pinned copy (they do not conflict).

**Known follow-up:** if your application pins its _own_ `lucide-svelte` version and your bundler's deduplication happens to collapse Cinder's nested pinned copy onto your application's version for Cinder's client-side (browser/`svelte` condition) source compile — while Cinder's prebuilt `dist/server` still resolves its own pinned copy — the two could still diverge. This is inherent to Cinder shipping both prebuilt server output and raw source for Svelte-aware bundlers. Closing that residual case fully would mean vendoring icon path data directly into Cinder rather than depending on `lucide-svelte` at all; that is out of scope for this fix and is tracked as a follow-up.
