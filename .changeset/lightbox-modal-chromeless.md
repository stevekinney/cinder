---
'@lostgradient/cinder': minor
---

Modal accepts a new `chrome?: 'default' | 'none'` prop. `chrome="none"` renders a chromeless, full-bleed surface — the header, visible title, border, `max-width: min(90vw, 32rem)`, and body padding are all suppressed — while every coordination guarantee (focus trap, scroll lock, escape-stack participation, the exit-transition lifecycle, `role="dialog"`/`aria-modal`) stays entirely unchanged. `title` is optional in the chromeless chrome; `aria-label` is required there instead, since no visible title renders to supply the accessible name. The chromeless body also no longer paints the shared scroll-fade's opaque edge gradient, since a transparent full-bleed surface has no surface color to fade into.

Modal also gains a supported backdrop-color override point: `.cinder-modal` declares `--cinder-modal-backdrop: var(--cinder-overlay-backdrop)`, and `::backdrop` reads `background-color: var(--cinder-modal-backdrop)`. Because `::backdrop` does not reliably inherit custom properties from its originating element across engines, a consumer override must target BOTH the `class` selector and that same class's `::backdrop` — e.g.

```css
.my-modal {
  --cinder-modal-backdrop: rgba(0, 0, 0, 0.9);
}
.my-modal::backdrop {
  --cinder-modal-backdrop: rgba(0, 0, 0, 0.9);
}
```

— without a `:global()` reach into Modal's internal selectors. (Setting the variable only on `.my-modal` looks like it should work and is silently a no-op in engines where `::backdrop` doesn't inherit it.)
