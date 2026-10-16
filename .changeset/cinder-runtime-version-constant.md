---
'@lostgradient/cinder': patch
---

Report the right version from `@lostgradient/cinder/tokens/runtime`. In 0.28.0, `CINDER_BASE.packageVersion` said `0.27.1`, because the release bumped the package manifest without updating the runtime's version constant. Release versioning now writes that constant from the manifest, so this release and every later one reports its own version. The token documents are unchanged, so `CINDER_BASE.sourceDigest` stays the same.
