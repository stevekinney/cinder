---
'@lostgradient/cinder': major
---

**Breaking: unify public API vocabulary across components.** Several public APIs
used different words for the same concept; this standardizes them. No compatibility
aliases are provided (per the audit's no-shim requirement) — update call sites.

- **Severity spelling.** `alert` and `status-dot` drop the `error` value in favor of
  `danger`, the canonical failure-severity spelling already used by `banner` and
  `callout`. Use `variant="danger"` (Alert) / `status="danger"` (StatusDot) instead
  of `"error"`.
- **Accessible-name props.** `ariaLabel` / `navAriaLabel` are renamed to `label` on
  `sidebar`, `scroll-area`, `navigation-bar`, and `dropdown-group`; `StatChange.ariaLabel`
  becomes `StatChange.label`.
- **Chat boolean props.** `isAtBottom` → `atBottom`, `hasNewMessageIndicator` →
  `newMessageIndicatorVisible`, `isStreaming` → `streaming`, `hasMoreHistory` →
  `moreHistoryAvailable`. The per-feature `allow*` flags (`allowAttachments`,
  `allowSearch`, `allowCopy`, `allowEditing`, `allowRetry`) are grouped into a single
  `capabilities` object prop.
- **FloatingActionButton visual API.** `color` → `variant` (the palette) and
  `variant` → `shape` (filled/extended). The exported types rename accordingly:
  `FloatingActionButtonColor` → `FloatingActionButtonVariant` and the old
  `FloatingActionButtonVariant` → `FloatingActionButtonShape`.

Generated schemas, README tables, examples, and package exports are updated to match.
