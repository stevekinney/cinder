# Focus Ring Policy

This document defines the approved strategies for `:focus-visible` rings in Cinder component CSS. Pick from this list. Do not invent a third approach.

> [!NOTE] Default recipe Component `:focus-visible` rules should use **Strategy B** — the transparent-outline placeholder paired with `box-shadow: var(--_cinder-focus-ring-shadow)` — unless the component matches the documented SVG chart-mark exception below. The `cinder/no-focus-visible-colored-outline` Stylelint rule enforces this: colored `outline` channels are rejected outside `@media (forced-colors: active)`. Strategy A (a colored outline) is retained for the bare `:focus-visible` global default in `foundation.css` only.

## Token Reference

Five tokens in `src/styles/tokens-base.css` (the `/* Focus ring */` block) are the only inputs either strategy should consume.

| Token                        | Default                            | Role                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--cinder-ring-width`        | `2px`                              | Accent ring thickness. Never hard-code `2px` or `3px` in new rules — use this token. Pre-existing fallbacks (e.g. `var(--cinder-ring-width, 2px)`) are tolerated but should be cleaned up opportunistically.                                                                                                                                           |
| `--cinder-ring-offset`       | `0px`                              | Distance between element edge and accent ring. Zero by default, so the ring is tight: one 2px band directly on the control edge. Used as `outline-offset` in Strategy A and as the offset-band thickness in Strategy B. Not used in Strategy B-inset. Emitted as `0px` rather than a bare `0` because Strategy B adds it to the width inside `calc()`. |
| `--cinder-ring-offset-color` | `var(--cinder-surface-raised)`     | Color of the gap band between a filled control and its ring (see [Filled Variants and States](#filled-variants-and-states)), and of the Strategy B offset band if a theme sets a non-zero offset. Unfilled controls paint no gap. Not used in A or B-inset.                                                                                            |
| `--cinder-ring-color`        | `light-dark(…)` accent             | The ring color. Per-variant overrides should use a private `--_cinder-<component>-ring` custom property whose fallback is `var(--cinder-ring-color)`.                                                                                                                                                                                                  |
| `--cinder-ring-on-accent`    | `light-dark(…)` near-black / white | The ring FloatingAction `primary` paints directly on its accent fill. It measures about 3:1 (light) and 2.5:1 (dark) against that fill, so other filled controls use the gap below instead.                                                                                                                                                            |

The default ring is tight. There is no offset band between the control and the ring, so a focused control shows a single 2px line rather than a 4px double band. Filled controls are the exception: they keep a 2px gap (below). The width stays `2px`, the WCAG 2.4.13 floor.

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

- `src/styles/foundation.css` — bare `:focus-visible` selector (global default). This is the only place Strategy A is sanctioned going forward.

## Strategy B — Box-shadow ring with transparent outline placeholder

Use when:

- The component would have `outline` clipped or visually merged with adjacent geometry (form fields, scrollable containers, rounded controls where the offset color band reads better than a plain outline gap).
- The component needs its ring color to change by variant or state (a private `--_cinder-<component>-ring` hook).

With the default zero offset the two-stop recipe paints one tight ring; the first stop has no spread. The two stops stay in the recipe so a theme that sets a non-zero `--cinder-ring-offset` still gets an offset band.

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

- `src/styles/components/button.css` — `.cinder-button:focus-visible`, uses `--_cinder-button-ring` per-variant override hook.
- `src/styles/components/input.css` — `.cinder-input:focus-visible`, uses `--_cinder-input-ring`.
- `src/styles/components/checkbox.css` — `.cinder-checkbox:focus-visible`, uses `--_cinder-checkbox-ring`.
- `src/styles/components/dropdown.css` — `.cinder-dropdown-trigger:focus-visible`, uses `--_cinder-dropdown-trigger-ring`.

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

- `.cinder-dropdown-item[data-cinder-variant='default']:focus-visible` and `.cinder-dropdown-item[data-cinder-variant='danger']:focus-visible` in `src/styles/components/dropdown.css` — items live inside `.cinder-dropdown__menu` (`overflow: hidden`).
- `.cinder-tab:focus-visible` in `src/components/tabs/tabs.css` — the tab sits inside `.cinder-tab-list`, whose `overflow-x: auto` forces both-axis clipping (per the CSS Overflow spec, an `auto`/`scroll` value on one axis promotes the other axis's `visible` to `auto`), so an outset ring is clipped on every edge. Uses the `--_cinder-tab-ring` hook.
- `.cinder-side-navigation-group__trigger:focus-visible` in `src/components/side-navigation-group/side-navigation-group.css` and `.cinder-navigation-item[data-variant='vertical']:focus-visible` in `src/components/navigation-item/navigation-item.css` — full-bleed rows inside the grouped-navigation container; an outset ring stretches/bleeds across the container boundary. Use the `--_cinder-side-navigation-group-trigger-ring` / `--_cinder-navigation-item-ring` hooks.
- `.cinder-collapsible__trigger:focus-visible` in `src/components/collapsible/collapsible.css` — the trigger is a full-bleed row whose rounded outer edge coincides with the bordered `.cinder-collapsible` root. The root intentionally preserves visible overflow for public descendants, but an outset trigger ring would paint beyond that shared component boundary and over adjacent layout instead of remaining attached to the full-bleed row. The inset ring stays inside the trigger and preserves both the root boundary and the 44 px minimum touch target.

The 2026-06 sweep also adopted B-inset for a batch of clipped/full-bleed children (see the Deviations Appendix). Adding a further component requires documenting the justification here.

## SVG Chart Marks — Stroke ring layer

Use this exception only for keyboard-focusable SVG chart marks, such as the `circle` data targets in AreaChart/LineChart and the `rect` bar targets in BarChart. SVG shapes do not reliably paint HTML `box-shadow`, and chart `svg` viewports intentionally clip overflow, so the normal Strategy B and B-inset recipes are not load-bearing for these marks.

Chart marks keep their transparent focus target for DOM focus and accessible naming, then render a separate `aria-hidden="true"` SVG focus-ring layer above the plot. The layer uses tokenized `stroke`, `stroke-width: var(--cinder-ring-width)`, `vector-effect: non-scaling-stroke`, and `pointer-events: none`; geometry is clamped inside the SVG viewport so edge marks still have a complete visible ring. In forced-colors mode the halo is hidden and the ring stroke uses `ButtonText` with `filter: none`.

## Picking Between A, B, and B-inset

| Situation                                                        | Strategy                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Component already has a `box-shadow` for elevation or decoration | A                                                              |
| Form field or button-shaped pressable on the page surface        | B                                                              |
| Focusable child of an `overflow: hidden` parent                  | B-inset                                                        |
| Keyboard-focusable SVG chart mark                                | SVG chart mark stroke layer                                    |
| Variant needs its own ring color                                 | B or B-inset with a `--_cinder-<component>-ring` fallback hook |

## Variant Ring Colors

Variants that change foreground or background **should not** change the ring color for their own sake. Focus ring color carries a single semantic — "keyboard focus is here." Use `--_cinder-<component>-ring` to distinguish one component's ring from the global default, to keep the established danger ring on invalid form fields, and for the filled-variant rule below.

## Filled Variants and States

When the focused element's own background is a solid accent, danger or status fill, a tight ring in the accent-hued `--cinder-ring-color` measures about 1.0 to 1.5:1 against that fill, and the control reads as growing by 2px rather than as focused. So the rule is this: any focused element whose own background at focus time is a solid fill paints a `--cinder-ring-offset-color` gap and then the standard `--cinder-ring-color` ring. With the gap the ring sits on the page, where it measures at least 4:1. The same element without the fill (unchecked, off, `aria-disabled`) keeps the tight ring.

The recipe is `var(--_cinder-focus-ring-filled-shadow)`, a private formula in `foundation.css`:

```css
.cinder-component[data-filled]:focus-visible {
  box-shadow: var(--_cinder-focus-ring-filled-shadow);
}
```

The gap width is the private constant `--_cinder-focus-ring-filled-gap` (`2px`), not a public token. No consumer has needed to tune it, and a public token would be one more knob to keep consistent across themes; promote it through the token source if that changes. The formula resolves its colors on `:root` (and again under `[data-theme]`), so a component whose filled ring must keep a per-state hook color, such as an invalid checked Checkbox keeping its danger ring, writes the two stops inline with the gap constant and its hook:

```css
.cinder-checkbox:checked:focus-visible {
  box-shadow:
    0 0 0 var(--_cinder-focus-ring-filled-gap) var(--cinder-ring-offset-color),
    0 0 0 calc(var(--_cinder-focus-ring-filled-gap) + var(--cinder-ring-width))
      var(--_cinder-checkbox-ring, var(--cinder-ring-color));
}
```

Filled variants and states that paint the gap today:

- Button `primary` and `danger`. A focusable `aria-disabled` button that is not loading has an inset fill and keeps the tight ring.
- Checkbox checked and indeterminate, and Radio checked (inline, so an invalid control keeps its danger ring).
- Toggle (switch) on (inline, so a consumer's `--cinder-toggle-ring` still applies).
- SegmentedControl selected, pressed, and current options outside the tablist variant.
- Chip pressed in the `accent`, `danger`, `success`, `warning`, and `info` variants.
- Pagination current page.
- Calendar range start and end days.
- SelectionPopover add-comment button and submit.
- SchemaForm submit.
- FileUpload browse button.
- CapabilityGate primary action.
- Chat's send button and new-message indicator in `@lostgradient/chat`.

FloatingAction `primary` predates this rule and keeps its tight `--cinder-ring-on-accent` ring.

Considered and excluded:

- Chip pressed in the `neutral` variant, a surface shift rather than a fill.
- The slider thumb (a raised fill with an accent border), the tablist SegmentedControl's selected tab (transparent), and pseudo-element fills such as the tab indicator and carousel dot. None of them is a solid fill on the focused element itself.
- Command items. Focus stays on the palette input through `aria-activedescendant`, and the active item draws its own `--cinder-accent-contrast` inset ring.
- Transient fills: a `soft-danger` Button while pressed and Chat's attachment-remove button on hover. They last only as long as the press or hover.

## Borders Under the Tight Ring

A bordered control's resting border must not show inside the tight ring: together they read as one heavier 3px shape. On focus the border turns transparent, which paints the control's own fill, in every state (default, invalid, read-only), and hover rules exclude the focused state so they cannot repaint it. This covers `_input-frame.css` (Select, Textarea, the MultiSelect trigger), Input, its host, and the input group (NumberInput, SearchField), TagInput, Combobox, and PinInput segments. DatePicker needs no change: its ring belongs to the borderless inner input and covers the control's border on that side.

## Exception: Command Palette Search

`.cinder-command-palette__input:focus-visible` paints no ring (`box-shadow: none`). The whole search row reads as the field and the caret shows focus; a ring around just the `<input>` left the search icon outside it and competed with the active option's fill. The rule keeps the transparent outline placeholder, and its `@media (forced-colors: active)` block repaints it with `Highlight`, so Windows High Contrast users still get a visible indicator.

## Enforcement (Stylelint)

The root `bun run lint` pipeline runs Stylelint over `packages/**/src/**/*.{css,svelte}` with the local `cinder/no-focus-visible-colored-outline` plugin (`scripts/stylelint/no-focus-visible-colored-outline.mjs`). The rule is configured at **`severity: error`**: every component-owned colored outline-only focus recipe has been migrated, so a colored `outline` in a non-forced-colors `:focus-visible` rule now fails the lint pipeline (non-zero exit) rather than emitting a tolerated warning. The only sanctioned colored-outline focus sites that remain are documented inline with a `stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- <reason>` comment: the `foundation.css` Strategy A global default, the `:focus:not(:focus-visible)` reset, and the ImageLightbox white-over-photo allowlist (see the Deviations appendix).

The rule:

- Rejects colored `outline`, `outline-color`, `outline-style`, and `outline-width` declarations inside any non-forced-colors `:focus-visible` rule. Token aliases (`var(--cinder-ring-color)`, `CanvasText`, `currentColor`, `revert`, `auto`) are all rejected — only the exact transparent placeholder `outline: var(--cinder-ring-width) solid transparent` is permitted.
- Allows colored outlines inside `@media (forced-colors: active)`. A comma-separated media query is treated as a forced-colors fallback only when **every** branch contains `(forced-colors: active)`; partial matches (e.g. `(forced-colors: active), (hover: hover)`) are rejected.
- Permits `outline: none` inside `:focus-visible` only when preceded by a `/* cinder-focus-ring-owner: parent */` comment on the line above.

Separate from the colored-outline allowlist above, `outline: none` inside a `:focus-visible` rule is permitted when a parent element owns the focus ring (it paints the ring via its own `box-shadow`, so the child must suppress the default outline rather than draw a second one). Mark each such site with the `/* cinder-focus-ring-owner: parent */` comment on the line directly above the `outline: none` declaration; the Stylelint rule already enforces that this comment is present before it allows the bare `outline: none`.

The `box-shadow` half of Strategy B (the requirement to reference `var(--_cinder-focus-ring-shadow)` rather than reconstruct the formula longhand) is pinned by parser-based tests in `src/test/focus-ring-recipe.test.ts`. New components that follow Strategy B should be added to that test file as a regression target.

Forced-colors fallbacks are exempt from the lint rule because `box-shadow` is suppressed in Windows High Contrast Mode — without an outline channel painted with a system color, the ring would vanish ([WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) failure).

## Deviations Appendix

**Tight ring and filled gap (resolved, 2026-10, COR-1498).** The default `--cinder-ring-offset` dropped from `2px` to `0px`, so the ring sits directly on the control edge instead of floating behind a 2px `--cinder-ring-offset-color` halo. Solid fills keep a 2px gap through `--_cinder-focus-ring-filled-shadow` (see [Filled Variants and States](#filled-variants-and-states)); an on-accent ring directly on the fill was measured first and rejected, because it fell below 3:1 against the fills in dark mode. Bordered controls now keep their border transparent while focused (see [Borders Under the Tight Ring](#borders-under-the-tight-ring)). The command palette search became a documented no-ring exception.

**Dropdown (resolved, 2026-05).** `.cinder-dropdown-trigger` and `.cinder-dropdown-item` previously used `outline: none` with a bare `0 0 0 2px var(--cinder-ring-color)` box-shadow — skipping `--cinder-ring-width`, omitting the transparent outline, and hard-coding `2px`. Both selectors were realigned: the trigger now follows Strategy B (matches `.cinder-button`), and the items follow Strategy B-inset (they live inside `.cinder-dropdown__menu` which sets `overflow: hidden`). The forced-colors override was updated to use variant-attribute selectors so it wins over the base rules' higher specificity.

**Slider thumb, tab panel, CopyButton, number-input stepper, selection-popover (resolved, 2026-05).** These selectors previously used Strategy A with a colored outline (or, in selection-popover's case, hardcoded `outline: 2px solid var(--cinder-accent-solid)`). They were realigned to Strategy B with explicit forced-colors fallbacks, and `code-block.css` lost its nested CopyButton focus override so the base recipe applies uniformly. The Stylelint rule was added at the same time to prevent the drift from returning.

**NavigationItem / Tab vertical variant (resolved, 2026-05).** `NavigationItem` and `Tab` had horizontal top-rounded/bottom-square radii by default, which the focus-ring `box-shadow` inherited as a tombstone shape in vertical contexts. The vertical geometry now lives on `.cinder-navigation-item[data-variant='vertical']` and `.cinder-tab[data-variant='vertical']` — emitted from `tabs.orientation` for tabs, and forced by `SideNavigationItem` for sidebar items. The previous ancestor-class reset in `side-navigation.css` was removed.

**Component-wide colored-outline sweep (resolved, 2026-06).** Roughly two dozen component-owned `:focus-visible` selectors still painted a colored `outline` as their only visible ring, predating this policy. They were migrated in one pass:

- **Strategy B (outer ring)** — pressables on the page surface: `.cinder-rating__option`, `.cinder-json-viewer__toggle`, `.cinder-toast__action`/`.cinder-toast__dismiss`, `.cinder-popover`, `.cinder-jse-property-row__trigger`, plus the Svelte `:global(.export-trigger)` (chat + review-editor), `.actions-trigger`, `.chat-empty-prompt`, and the chat-search-bar nav/close buttons.
- **Strategy B-inset** — focusable children of clipping/overflow containers and full-bleed rows: `.cinder-tree-item`, `.cinder-accordion-item__trigger`, `.cinder-collapsible__trigger`, the modal/drawer `__close` corner buttons, `.cinder-search-field__clear`, the markdown-editor `.surface`, and the Svelte hits `button.diff-line`, `.link-popover-close`, `.thread-popover-close`, `.thread-item`, `.artifact-panel-close`, `.chat-timeline`, `.message-attachment-button`, and the `.chat-input-attachment-remove` chip (ring painted on its `::before` visible circle).

**Tabs / SideNavigation focus-ring clipping (resolved, 2026-06).** Three sibling bug fixes converted clipped/bleeding outset rings to Strategy B-inset:

- `.cinder-tab:focus-visible` previously used the outset Strategy B `box-shadow: var(--_cinder-focus-ring-shadow)`. `.cinder-tab-list` sets `overflow-x: auto`, which the CSS Overflow spec promotes to both-axis clipping, so the 4px outset ring was clipped on the top, bottom, and trailing edges (only the first tab's leading edge survived). Now an inset single-band ring via `--_cinder-tab-ring`; the active-indicator `::after` stripe is untouched, so selected and focused remain visually distinct. Forced-colors repaint uses `ButtonText` (a `role="tab"` is a pressable) with a negative `outline-offset` so the high-contrast outline is drawn inside the clip too.
- `.cinder-side-navigation-group__trigger:focus-visible` and `.cinder-navigation-item[data-variant='vertical']:focus-visible` previously drew outset rings that stretched full-width and bled across / clipped at the grouped-navigation container boundary. Now inset rings via their `--_cinder-*-ring` hooks, so each draws a complete ring around its own focusable bounds without bleeding into neighbors or being flattened by active-item backgrounds.

Every converted selector that lacked one gained an `@media (forced-colors: active)` override (`ButtonText` for pressables/menuitems; B-inset close buttons use `outline-offset: calc(var(--cinder-ring-width) * -1)` so the HCM ring stays inside the clip). The toast shared forced-colors block was promoted from `outline-color: ButtonText` to a full `outline: var(--cinder-ring-width) solid ButtonText` so the transparent placeholder is overpainted. With the sweep complete, the Stylelint rule was promoted from `warning` to `error`.

**ImageLightbox white-over-photo allowlist (documented exception, 2026-06).** `.lightbox-close` and `.lightbox-nav` (in `components/chat/src/lib/components/chat/message/image-lightbox.svelte`) keep `outline: 2px solid white`. These controls float over an arbitrary dimmed photo backdrop where the accent ring color cannot guarantee contrast; a literal white outline is the deliberate high-contrast choice, and a solid white outline is already preserved in Windows High Contrast Mode, so no forced-colors override is needed. Each is annotated with a `stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- white-over-photo contrast` comment so the `error`-severity rule permits exactly these two sites.
