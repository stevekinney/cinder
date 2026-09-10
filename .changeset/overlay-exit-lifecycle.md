---
'@lostgradient/cinder': patch
---

Toast: `.cinder-toast-shell` now renders the canonical `data-cinder-closing` attribute (additive,
alongside the existing `data-cinder-presence`) for the full duration of a dismissed toast's exit
transition, per OVERLAY-POLICY.md's transition-lifecycle contract.

CommandPalette: adopts `SlidingDialogState` (the same exit-lifecycle mechanism Modal and Drawer use)
instead of closing instantly. Closing now renders `data-cinder-closing` on the panel and plays a real
`opacity`/`translate` exit transition, awaiting completion before the native dialog closes; the panel
enter/exit CSS moved from `animation`/`@keyframes` to `transition`-driven styles so the shared
`waitForTransitionCompletion` helper can detect it. The palette also now acquires the counted
`lockBodyScroll()` on open and releases it on close (a modal-class overlay guarantee it previously
lacked), and its SSR output is empty regardless of the initial `open` value (previously `open={true}`
emitted the dialog markup during SSR).
