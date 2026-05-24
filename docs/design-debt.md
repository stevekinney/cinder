# Design Debt

This document records design decisions that unblock implementation tasks without
requiring future executors to reopen the same product question.

## Component Consolidation

### C2. Alert and Callout are visually indistinguishable

**Decision ID:** P6-C2
**Source task:** `f1834ce9-87fe-4e21-9043-02b89b429abd`
**Status:** Resolved
**Decision date:** 2026-05-23

**Decision:** Keep `Alert` and `Callout` as separate components and differentiate their visual treatments.

**Accessibility boundary:** `Alert` remains the live-region notification (`role="alert"`); `Callout` remains the static prose aside (`<aside>`, no live region).

**Implementation direction:** Give `Callout` a dominant `border-inline-start` stripe that uses the existing semantic status token pattern already used in `callout.css`: `var(--cinder-info)`, `var(--cinder-success)`, `var(--cinder-warning)`, and `var(--cinder-danger)`, with the same `oklch(from var(--cinder-{status}) ... h)` color algebra used by the current variant rules. Reduce `Alert`'s persistent card chrome by choosing one exact container change: replace the variant tinted full-card `background-color` with `var(--cinder-surface)`, or replace the variant-colored one-pixel `border-color` with `var(--cinder-border)`.

Implementation acceptance:

- `Callout` variants (`info`, `success`, `warning`, `danger`) must set `border-inline-start-width` to a larger value than `border-inline-end-width` and derive that stripe color from `--cinder-info`, `--cinder-success`, `--cinder-warning`, or `--cinder-danger` for the matching variant.
- `Alert` variants (`info`, `success`, `warning`, `error`) must stay stripe-free and must satisfy one of these two exact outcomes: each variant's computed `background-color` equals the base `Alert` surface color, or each variant's computed `border-color` equals the base `Alert` border color.
- Computed-style tests must prove `Callout` has a larger `border-inline-start-width` than `border-inline-end-width`, and `Alert` does not, across both light and dark color schemes.
- `Alert` must keep `role="alert"` and must not become `role="status"`; `Callout` must not add live-region roles or `aria-live` attributes.
