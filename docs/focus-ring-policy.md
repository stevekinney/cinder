# Focus Ring Policy

This document defines the two approved strategies for `:focus-visible` rings in Cinder component CSS. Pick from this list. Do not invent a third approach.

## Token Reference

Four tokens in `packages/components/src/styles/tokens-base.css` (the `/* Focus ring */` block) are the only inputs either strategy should consume.

| Token                        | Default                | Role                                                                                                                                                                                                         |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--cinder-ring-width`        | `3px`                  | Accent ring thickness. Never hard-code `2px` or `3px` in new rules — use this token. Pre-existing fallbacks (e.g. `var(--cinder-ring-width, 2px)`) are tolerated but should be cleaned up opportunistically. |
| `--cinder-ring-offset`       | `1px`                  | Distance between element edge and accent ring. Used as `outline-offset` in Strategy A and as the offset-band thickness in Strategy B. Not used in Strategy B-inset.                                          |
| `--cinder-ring-offset-color` | `var(--cinder-bg)`     | Color of the offset band in Strategy B. Matches the page background so the ring visually floats off the control. Not used in A or B-inset.                                                                   |
| `--cinder-ring-color`        | `light-dark(…)` accent | The ring color. Per-variant overrides should use a private `--_cinder-<component>-ring` custom property whose fallback is `var(--cinder-ring-color)`.                                                        |

## Strategy A — Outline ring

Use when:

- The component's `box-shadow` is reserved for something else (elevation, an inset border, a composed effect).
- A single-band ring is sufficient and no offset color band is needed between the element edge and the ring.

```css
.cinder-component:focus-visible {
  outline: var(--cinder-ring-width) solid var(--cinder-ring-color);
  outline-offset: var(--cinder-ring-offset);
}
```

`outline-offset` may be a fixed pixel value when a specific nudge is needed — some call sites use `2px` or `3px`. The rule against hard-coding applies to **ring thickness** (`--cinder-ring-width`) and **ring color** (`--cinder-ring-color`) only.

Strategy A does **not** need a `@media (forced-colors: active)` override. A solid `outline` is already preserved by forced-colors mode (the system substitutes a system color). Adding a redundant override is unnecessary.

**Representative call sites** (selector references):

- `packages/components/src/styles/foundation.css` — bare `:focus-visible` selector (global default).
- `packages/components/src/styles/components/breadcrumbs.css` — `.cinder-breadcrumbs__link:focus-visible`.
- `packages/components/src/styles/components/copy-button.css` — `.cinder-copy-button:focus-visible`.
- `packages/components/src/styles/components/tabs.css` — `.cinder-tab-panel:focus-visible`.

## Strategy B — Box-shadow ring with transparent outline placeholder

Use when:

- The component would have `outline` clipped or visually merged with adjacent geometry (form fields, scrollable containers, rounded controls where the offset color band reads better than a plain outline gap).
- The component needs a double ring: a thin offset band in the page background color separating the element from the accent ring.

```css
.cinder-component:focus-visible {
  outline: var(--cinder-ring-width) solid transparent;
  box-shadow:
    0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
    0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width))
      var(--_cinder-component-ring, var(--cinder-ring-color));
}

@media (forced-colors: active) {
  .cinder-component:focus-visible {
    outline: var(--cinder-ring-width) solid ButtonText; /* or Highlight — see below */
    outline-offset: 3px;
  }
}
```

**Why the transparent outline is load-bearing.** In Windows High Contrast Mode `box-shadow` is suppressed by the browser. Without an outline channel reserved, the focus indicator vanishes — a WCAG 2.4.7 failure. The forced-colors block repaints that channel with a system color. Never omit `outline: var(--cinder-ring-width) solid transparent` from a Strategy B rule.

**Forced-colors color choice.** Use `ButtonText` when the element is `<button>`-shaped or `role="menuitem"` — anything the user clicks or activates. Use `Highlight` for text-entry surfaces (`input`, `textarea`, `select`) and for selection states.

**Cascade order.** The base `:focus-visible` rule must appear **before** its `@media (forced-colors: active)` override in source order, or the override must carry equal or higher specificity. See the specificity note in the B-inset section below.

**Representative call sites:**

- `packages/components/src/styles/components/button.css` — `.cinder-button:focus-visible`, uses `--_cinder-button-ring` per-variant override hook.
- `packages/components/src/styles/components/input.css` — `.cinder-input:focus-visible`, uses `--_cinder-input-ring`.
- `packages/components/src/styles/components/checkbox.css` — `.cinder-checkbox:focus-visible`, uses `--_cinder-checkbox-ring`.
- `packages/components/src/styles/components/dropdown.css` — `.cinder-dropdown-trigger:focus-visible`, uses `--_cinder-dropdown-trigger-ring`.

## Strategy B-inset — Inset single-band ring (constrained sub-variant of B)

Use **only** when both conditions hold:

1. The element is a focusable child of a container with `overflow: hidden` (or similar clipping). An outset ring on the first or last child would be clipped by the container.
2. An inset ring won't pinch element contents below a 44 px minimum touch target.

```css
.cinder-component-child:focus-visible {
  outline: var(--cinder-ring-width) solid transparent;
  box-shadow: inset 0 0 0 var(--cinder-ring-width)
    var(--_cinder-component-child-ring, var(--cinder-ring-color));
}

@media (forced-colors: active) {
  .cinder-component-child:focus-visible {
    outline: var(--cinder-ring-width) solid ButtonText;
    outline-offset: calc(var(--cinder-ring-width) * -1);
  }
}
```

The offset color band is intentionally omitted — there is no usable space inside a clipped child for two layered rings.

**Specificity rule.** `@media` does not boost selector specificity. If the base rule uses an attribute selector (e.g., `.cinder-dropdown-item[data-cinder-variant='default']:focus-visible`, specificity `0,3,0`), the forced-colors override must match that specificity — a plain class + pseudo-class selector (specificity `0,2,0`) will lose even inside the media block. Duplicate the variant selectors in the forced-colors block.

**Approved call sites today:** `.cinder-dropdown-item[data-cinder-variant='default']:focus-visible` and `.cinder-dropdown-item[data-cinder-variant='danger']:focus-visible` in `packages/components/src/styles/components/dropdown.css`. Adding a second component requires documenting the justification in this policy.

## Picking Between A, B, and B-inset

| Situation                                                        | Strategy                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Component already has a `box-shadow` for elevation or decoration | A                                                              |
| Form field or button-shaped pressable on the page surface        | B                                                              |
| Focusable child of an `overflow: hidden` parent                  | B-inset                                                        |
| Variant needs its own ring color                                 | B or B-inset with a `--_cinder-<component>-ring` fallback hook |

## Variant Ring Colors

Variants that change foreground or background (danger inputs, accent buttons) **should not** change the ring color. Focus ring color carries a single semantic — "keyboard focus is here." A danger-toned ring on a danger-toned background loses contrast and confuses the focus signal. Use `--_cinder-<component>-ring` only to distinguish one component's ring from the global default, not to reflect variant state.

## Future Enforcement

Cinder does not currently run stylelint. A custom rule could enforce: "any `:focus-visible` block containing `box-shadow` must also contain `outline` set to either `transparent` or a non-`none` value." This would catch the bare-box-shadow deviation this policy was written to fix. Wiring up stylelint is a separate task.

## Deviations Appendix

**Dropdown (resolved, 2026-05).** `.cinder-dropdown-trigger` and `.cinder-dropdown-item` previously used `outline: none` with a bare `0 0 0 2px var(--cinder-ring-color)` box-shadow — skipping `--cinder-ring-width`, omitting the transparent outline, and hard-coding `2px`. Both selectors were realigned: the trigger now follows Strategy B (matches `.cinder-button`), and the items follow Strategy B-inset (they live inside `.cinder-dropdown__menu` which sets `overflow: hidden`). The forced-colors override was updated to use variant-attribute selectors so it wins over the base rules' higher specificity.
