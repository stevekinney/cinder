---
'@lostgradient/cinder': minor
---

Add a configurable `headingLevel` to PageHeader, from `1` to `6`, defaulting to `1`, so a page header nested inside a page that already has an `<h1>` keeps a correct document outline. Out-of-range values are clamped. The `PageHeaderHeadingLevel` type is exported from the package root.
