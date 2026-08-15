---
'@lostgradient/chat': patch
---

Document, in this package's README, that `Chat`'s `row`/`messagePart` overrides are inversion-of-control (each receives a `renderDefault` snippet and wraps the built-in rendering) — the counterpart half of the judgement call recorded in [#1311](https://github.com/stevekinney/cinder/pull/1311), which added the matching note to `@lostgradient/editor`'s README about `DiffViewer`'s `toolbar` prop being total replacement with no `renderDefault`, deliberately unlike `Chat`'s.

#1311 shipped the README section itself in this package but only added a changeset for `@lostgradient/editor`, so the "Overriding built-in rendering" section landed on `main` without ever going out in a `@lostgradient/chat` release. This changeset is the missing release trigger for content that's already merged — no code or README change here, patch because it's docs-only.
