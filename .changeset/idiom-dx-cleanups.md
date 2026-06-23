---
'@lostgradient/cinder': minor
---

Idiom & developer-experience cleanups (audit #468).

**Breaking type rename.** `diff-viewer`'s exported `ViewMode` type is renamed to
`DiffViewerMode` for a self-describing, collision-free public name. There is no
compatibility alias (per the audit's no-shim requirement) — consumers importing
`ViewMode` from `@lostgradient/cinder` or `@lostgradient/cinder/diff-viewer` must
import `DiffViewerMode` instead.

**Accessibility.** `CheckboxGroup` and `RadioGroup` now emit a development-only
warning when they render a `<fieldset>` without an accessible group name
(`<legend>`/label), matching the rest of the form-control suite.

**Correctness.** The `run-step-timeline` rail uses logical positioning
(`inset-inline-start`/`inset-block-start`/`inline-size`) so it lays out correctly
in right-to-left contexts. Several icon-button hit areas were enlarged for touch.

**Maintenance (no behavior change).** Svelte 4 lifecycle helpers migrated to
`$effect`, hand-rolled `ResizeObserver` setups moved to the shared
`useResizeObserver` utility, and `use:`-actions converted to `{@attach}`
attachments. Form-control `error` props consistently include `undefined`.
Review-editor types are consolidated into one authoritative module.
