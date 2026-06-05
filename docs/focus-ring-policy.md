# Focus Ring Policy

This document defines the approved strategies for `:focus-visible` rings in Cinder component CSS. Pick from this list. Do not invent a third approach.

> [!NOTE] Default recipe
> Component `:focus-visible` rules should use **Strategy B** — the transparent-outline placeholder paired with `box-shadow: var(--_cinder-focus-ring-shadow)`. The `cinder/no-focus-visible-colored-outline` Stylelint rule enforces this: colored `outline` channels are rejected outside `@media (forced-colors: active)`. Strategy A (a colored outline) is retained for the bare `:focus-visible` global default in `foundation.css` only.

## Token Reference

Four tokens in `packages/components/src/styles/tokens-base.css` (the `/* Focus ring */` block) are the only inputs either strategy should consume.

| Token                        | Default                | Role                                                                                                                                                                                                         |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--cinder-ring-width`        | `3px`                  | Accent ring thickness. Never hard-code `2px` or `3px` in new rules — use this token. Pre-existing fallbacks (e.g. `var(--cinder-ring-width, 2px)`) are tolerated but should be cleaned up opportunistically. |
| `--cinder-ring-offset`       | `1px`                  | Distance between element edge and accent ring. Used as `outline-offset` in Strategy A and as the offset-band thickness in Strategy B. Not used in Strategy B-inset.                                          |
| `--cinder-ring-offset-color` | `var(--cinder-bg)`     | Color of the offset band in Strategy B. Matches the page background so the ring visually floats off the control. Not used in A or B-inset.                                                                   |
| `--cinder-ring-color`        | `light-dark(…)` accent | The ring color. Per-variant overrides should use a private `--_cinder-<component>-ring` custom property whose fallback is `var(--cinder-ring-color)`.                                                        |

## Strategy A — Outline ring (foundation-only)

Use when:

- The selector is the **bare `:focus-visible` global default** in `foundation.css`. That single low-specificity rule paints the baseline ring for any element a component CSS file does not own.
- Otherwise, do not pick Strategy A for new component rules. The Stylelint rule will reject a colored `outline` in `:focus-visible`. Existing call sites that still use Strategy A should migrate to Strategy B opportunistically.

```css
.cinder-component:focus-visible {
  outline: var(--cinder-ring-width) solid var(--cinder-ring-color);
  outline-offset: var(--cinder-ring-offset);
}
```

`outline-offset` may be a fixed pixel value when a specific nudge is needed — some call sites use `2px` or `3px`. The rule against hard-coding applies to **ring thickness** (`--cinder-ring-width`) and **ring color** (`--cinder-ring-color`) only.

Strategy A does **not** need a `@media (forced-colors: active)` override. A solid `outline` is already preserved by forced-colors mode (the system substitutes a system color). Adding a redundant override is unnecessary.

**Representative call site:**

- `packages/components/src/styles/foundation.css` — bare `:focus-visible` selector (global default). This is the only place Strategy A is sanctioned going forward.

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

**Why the transparent outline is load-bearing.** In Windows High Contrast Mode `box-shadow` is suppressed by the browser. Without an outline channel reserved, the focus indicator vanishes — a [WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) failure. The forced-colors block repaints that channel with a system color. Never omit `outline: var(--cinder-ring-width) solid transparent` from a Strategy B rule.

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

**Approved call sites today:**

- `.cinder-dropdown-item[data-cinder-variant='default']:focus-visible` and `.cinder-dropdown-item[data-cinder-variant='danger']:focus-visible` in `packages/components/src/styles/components/dropdown.css` — items live inside `.cinder-dropdown__menu` (`overflow: hidden`).
- `.cinder-tab:focus-visible` in `packages/components/src/components/tabs/tabs.css` — the tab sits inside `.cinder-tab-list`, whose `overflow-x: auto` forces both-axis clipping (per the CSS Overflow spec, an `auto`/`scroll` value on one axis promotes the other axis's `visible` to `auto`), so an outset ring is clipped on every edge. Uses the `--_cinder-tab-ring` hook.
- `.cinder-side-navigation-group__trigger:focus-visible` in `packages/components/src/components/side-navigation-group/side-navigation-group.css` and `.cinder-navigation-item[data-variant='vertical']:focus-visible` in `packages/components/src/components/navigation-item/navigation-item.css` — full-bleed rows inside the grouped-navigation container; an outset ring stretches/bleeds across the container boundary. Use the `--_cinder-side-navigation-group-trigger-ring` / `--_cinder-navigation-item-ring` hooks.

The 2026-06 sweep also adopted B-inset for a batch of clipped/full-bleed children (see the Deviations Appendix). Adding a further component requires documenting the justification here.

## Picking Between A, B, and B-inset

| Situation                                                        | Strategy                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Component already has a `box-shadow` for elevation or decoration | A                                                              |
| Form field or button-shaped pressable on the page surface        | B                                                              |
| Focusable child of an `overflow: hidden` parent                  | B-inset                                                        |
| Variant needs its own ring color                                 | B or B-inset with a `--_cinder-<component>-ring` fallback hook |

## Variant Ring Colors

Variants that change foreground or background (danger inputs, accent buttons) **should not** change the ring color. Focus ring color carries a single semantic — "keyboard focus is here." A danger-toned ring on a danger-toned background loses contrast and confuses the focus signal. Use `--_cinder-<component>-ring` only to distinguish one component's ring from the global default, not to reflect variant state.

## Enforcement (Stylelint)

The root `bun run lint` pipeline runs Stylelint over `packages/**/src/**/*.{css,svelte}` with the local `cinder/no-focus-visible-colored-outline` plugin (`packages/components/scripts/stylelint/no-focus-visible-colored-outline.mjs`). The rule is configured at **`severity: error`**: every component-owned colored outline-only focus recipe has been migrated, so a colored `outline` in a non-forced-colors `:focus-visible` rule now fails the lint pipeline (non-zero exit) rather than emitting a tolerated warning. The only sanctioned colored-outline focus sites that remain are documented inline with a `stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- <reason>` comment: the `foundation.css` Strategy A global default, the `:focus:not(:focus-visible)` reset, and the ImageLightbox white-over-photo allowlist (see the Deviations appendix).

The rule:

- Rejects colored `outline`, `outline-color`, `outline-style`, and `outline-width` declarations inside any non-forced-colors `:focus-visible` rule. Token aliases (`var(--cinder-ring-color)`, `CanvasText`, `currentColor`, `revert`, `auto`) are all rejected — only the exact transparent placeholder `outline: var(--cinder-ring-width) solid transparent` is permitted.
- Allows colored outlines inside `@media (forced-colors: active)`. A comma-separated media query is treated as a forced-colors fallback only when **every** branch contains `(forced-colors: active)`; partial matches (e.g. `(forced-colors: active), (hover: hover)`) are rejected.
- Permits `outline: none` inside `:focus-visible` only when preceded by a `/* cinder-focus-ring-owner: parent */` comment on the line above.

Separate from the colored-outline allowlist above, `outline: none` inside a `:focus-visible` rule is permitted when a parent element owns the focus ring (it paints the ring via its own `box-shadow`, so the child must suppress the default outline rather than draw a second one). Mark each such site with the `/* cinder-focus-ring-owner: parent */` comment on the line directly above the `outline: none` declaration; the Stylelint rule already enforces that this comment is present before it allows the bare `outline: none`.

The `box-shadow` half of Strategy B (the requirement to reference `var(--_cinder-focus-ring-shadow)` rather than reconstruct the formula longhand) is pinned by parser-based tests in `packages/components/src/test/focus-ring-recipe.test.ts`. New components that follow Strategy B should be added to that test file as a regression target.

Forced-colors fallbacks are exempt from the lint rule because `box-shadow` is suppressed in Windows High Contrast Mode — without an outline channel painted with a system color, the ring would vanish ([WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) failure).

## Deviations Appendix

**Dropdown (resolved, 2026-05).** `.cinder-dropdown-trigger` and `.cinder-dropdown-item` previously used `outline: none` with a bare `0 0 0 2px var(--cinder-ring-color)` box-shadow — skipping `--cinder-ring-width`, omitting the transparent outline, and hard-coding `2px`. Both selectors were realigned: the trigger now follows Strategy B (matches `.cinder-button`), and the items follow Strategy B-inset (they live inside `.cinder-dropdown__menu` which sets `overflow: hidden`). The forced-colors override was updated to use variant-attribute selectors so it wins over the base rules' higher specificity.

**Slider thumb, tab panel, CopyButton, number-input stepper, selection-popover (resolved, 2026-05).** These selectors previously used Strategy A with a colored outline (or, in selection-popover's case, hardcoded `outline: 2px solid var(--cinder-accent)`). They were realigned to Strategy B with explicit forced-colors fallbacks, and `code-block.css` lost its nested CopyButton focus override so the base recipe applies uniformly. The Stylelint rule was added at the same time to prevent the drift from returning.

**NavigationItem / Tab vertical variant (resolved, 2026-05).** `NavigationItem` and `Tab` had horizontal top-rounded/bottom-square radii by default, which the focus-ring `box-shadow` inherited as a tombstone shape in vertical contexts. The vertical geometry now lives on `.cinder-navigation-item[data-variant='vertical']` and `.cinder-tab[data-variant='vertical']` — emitted from `tabs.orientation` for tabs, and forced by `SideNavigationItem` for sidebar items. The previous ancestor-class reset in `side-navigation.css` was removed.

**Component-wide colored-outline sweep (resolved, 2026-06).** Roughly two dozen component-owned `:focus-visible` selectors still painted a colored `outline` as their only visible ring, predating this policy. They were migrated in one pass:

- **Strategy B (outer ring)** — pressables on the page surface: `.cinder-rating__option`, `.cinder-json-viewer__toggle`, `.cinder-collapsible__trigger`, `.cinder-toast__action`/`.cinder-toast__dismiss`, `.cinder-popover`, `.cinder-jse-property-row__trigger`, plus the Svelte `:global(.export-trigger)` (chat + review-editor), `.actions-trigger`, `.chat-empty-prompt`, and the chat-search-bar nav/close buttons.
- **Strategy B-inset** — focusable children of clipping/overflow containers and full-bleed rows: `.cinder-tree-item`, `.cinder-accordion-item__trigger`, the modal/drawer/sheet `__close` corner buttons, `.cinder-search-field__clear`, the markdown-editor `.surface`, and the Svelte hits `button.diff-line`, `.link-popover-close`, `.thread-popover-close`, `.thread-item`, `.artifact-panel-close`, `.chat-timeline`, `.message-attachment-button`, and the `.chat-input-attachment-remove` chip (ring painted on its `::before` visible circle).

**Tabs / SideNavigation focus-ring clipping (resolved, 2026-06).** Three sibling bug fixes converted clipped/bleeding outset rings to Strategy B-inset:

- `.cinder-tab:focus-visible` previously used the outset Strategy B `box-shadow: var(--_cinder-focus-ring-shadow)`. `.cinder-tab-list` sets `overflow-x: auto`, which the CSS Overflow spec promotes to both-axis clipping, so the 4px outset ring was clipped on the top, bottom, and trailing edges (only the first tab's leading edge survived). Now an inset single-band ring via `--_cinder-tab-ring`; the active-indicator `::after` stripe is untouched, so selected and focused remain visually distinct. Forced-colors repaint uses `ButtonText` (a `role="tab"` is a pressable) with a negative `outline-offset` so the high-contrast outline is drawn inside the clip too.
- `.cinder-side-navigation-group__trigger:focus-visible` and `.cinder-navigation-item[data-variant='vertical']:focus-visible` previously drew outset rings that stretched full-width and bled across / clipped at the grouped-navigation container boundary. Now inset rings via their `--_cinder-*-ring` hooks, so each draws a complete ring around its own focusable bounds without bleeding into neighbors or being flattened by active-item backgrounds.

Every converted selector that lacked one gained an `@media (forced-colors: active)` override (`ButtonText` for pressables/menuitems; B-inset close buttons use `outline-offset: calc(var(--cinder-ring-width) * -1)` so the HCM ring stays inside the clip). The toast shared forced-colors block was promoted from `outline-color: ButtonText` to a full `outline: var(--cinder-ring-width) solid ButtonText` so the transparent placeholder is overpainted. With the sweep complete, the Stylelint rule was promoted from `warning` to `error`.

**ImageLightbox white-over-photo allowlist (documented exception, 2026-06).** `.lightbox-close` and `.lightbox-nav` (in `chat/message/image-lightbox.svelte`) keep `outline: 2px solid white`. These controls float over an arbitrary dimmed photo backdrop where the accent ring color cannot guarantee contrast; a literal white outline is the deliberate high-contrast choice, and a solid white outline is already preserved in Windows High Contrast Mode, so no forced-colors override is needed. Each is annotated with a `stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- white-over-photo contrast` comment so the `error`-severity rule permits exactly these two sites.
