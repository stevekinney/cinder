---
'@lostgradient/cinder': minor
---

Modal accepts a new `chrome?: 'default' | 'none'` prop. `chrome="none"` renders a chromeless, full-bleed surface — the header, visible title, border, `max-width: min(90vw, 32rem)`, and body padding are all suppressed — while every coordination guarantee (focus trap, scroll lock, escape-stack participation, the exit-transition lifecycle, `role="dialog"`/`aria-modal`) stays entirely unchanged. `title` is optional in the chromeless chrome; `aria-label` is required there instead, since no visible title renders to supply the accessible name. Modal also gains a supported backdrop-color override point: the `::backdrop` background now reads `var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop))`, so a consumer can scope a darker (or lighter) backdrop through the existing `class` prop — e.g. `.my-modal { --cinder-modal-backdrop: rgba(0, 0, 0, 0.9); }` — without a `:global()` reach into Modal's internal selectors.
