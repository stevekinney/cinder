---
'@lostgradient/cinder': patch
---

Add `@media (forced-colors: active)` focus-ring fallbacks to nine components whose `:focus-visible` ring relied exclusively on `box-shadow` — which Windows High Contrast Mode (forced-colors) removes. Keyboard focus was invisible in HCM for users of CapabilityGate, KanbanBoard, MediaControls, PermissionMatrix, ShareCard, TransferList, Table, MenuBar, and ChatConversationList.

Each fallback repaints the outline with `ButtonText` at the correct offset for the control type: `3px` for bordered controls (separates the ring from `ButtonBorder`, which shares the `ButtonText` color family in HCM), `2px` for borderless controls, and an inset `calc(-1 * var(--cinder-ring-width))` for the TransferList scrollable panel (which has `overflow: auto` — a positive offset would be clipped). Each fallback also sets `box-shadow: none` explicitly so forced-colors suppression is unambiguous across engines.

A new Stylelint rule (`cinder/require-forced-colors-focus-fallback`) is wired into root `.stylelintrc.json` and into the test suite, so any future `:focus-visible` rule that relies on `box-shadow` without a matching forced-colors fallback will fail linting.
