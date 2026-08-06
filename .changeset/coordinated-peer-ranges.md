---
'@lostgradient/editor': minor
'@lostgradient/chat': minor
---

Widen Editor's and Chat's peer ranges to the Cinder and Markdown minors releasing
alongside them: `@lostgradient/cinder` `^0.20.0` → `^0.21.0`, and
`@lostgradient/markdown` `^0.1.0` → `^0.2.0`.

Without this the release ships Editor and Chat declaring peer ranges that exclude
the very Cinder and Markdown versions published in the same batch — `^0.1.0`
resolves to `>=0.1.0 <0.2.0` under semver's 0.x rule, so Markdown 0.2.0 falls
outside it, and every consumer installing the set together gets an unmet-peer
error. This is a coordinated minor across all four packages, which is also what
the package-boundary tests' `pendingCoordinatedMinorRelease` escape expects.
