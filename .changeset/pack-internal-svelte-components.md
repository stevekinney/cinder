---
'@lostgradient/cinder': patch
---

Ship `src/_internal/**/*.svelte` in the published tarball. The FormField
composition refactor moved control markup into internal Svelte components that
all three packing surfaces (the generated `files` globs, the exports
generator's static list, and pack-for-publish's staged list) excluded, so
consumer installs crashed during hydration. Fixture modules
(`*.fixture.ts`/`*.fixtures.ts`) no longer ship. A new packed-import-closure
test validates that every relative import reachable from packed sources is
itself packed, for both glob surfaces, in per-PR CI.
