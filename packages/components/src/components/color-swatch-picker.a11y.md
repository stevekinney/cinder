# Color Swatch Picker — Accessibility Rationale

## Listbox + option semantics

The component renders `<ul role="listbox">` with `<li role="option">` children. This maps
directly to the WAI-ARIA Listbox pattern and is the correct semantic for "pick one item from
a fixed set." The `label` prop (required) provides the listbox's accessible name via
`aria-label` so screen readers announce the control's purpose before reading options.

Each option carries:

- `aria-selected` (`true` on the selected item, `false` on others).
- `aria-label` computed as `name ? \`${name}, ${color}\` : color` — both the human label and
  the hex code are read aloud so users know both what the swatch represents and its value.
- `aria-disabled="true"` on disabled swatches; they remain in the DOM so users browsing in
  virtual cursor mode can still perceive that a swatch exists and is unavailable.

## Roving tabindex

Only the focused option has `tabindex="0"`; all others are `tabindex="-1"`. The entire
listbox participates in the page's tab order as a single stop. Arrow keys move focus within
the control; Tab exits it. This follows the WAI-ARIA APG composite widget pattern and is
the same model used by `segmented-control.svelte`.

## Explicit selection (not selection-follows-focus)

Users roam through options with arrow keys without inadvertently changing the selection;
Enter or Space commits the focused swatch. This matches WAI-ARIA APG §"Listbox with
explicit selection" and avoids the "I arrowed past and lost my selection" footgun that
auto-selection creates.

## Grid layout navigation

Grid layout enables both ArrowLeft/Right and ArrowUp/Down — all four arrows move by ±1 in
DOM order (one-dimensional wrapping). True column-aware navigation (ArrowDown goes to the
item visually below) is not implemented in v1 because it requires CSS Grid introspection or
bounding-box math at keydown time, adding complexity that depends on viewport width. The
plan documents this decision and tracks a potential v2.

## Stack layout navigation

Stack layout enables only ArrowUp/Down. ArrowLeft/Right are no-ops in this layout.

## Disabled handling

**Per-option disabled:** arrow-key roving skips the option. Click and Enter/Space are
ignored. The swatch is still focusable via Tab in edge cases (e.g., when all other options
are also disabled) so the control always has at least one tab stop.

**Whole-component disabled:** `aria-disabled="true"` on the `<ul>`. The currently-selected
(or first) option retains `tabindex="0"` so users can discover the control exists. All
activation (arrow keys, Home, End, Enter, Space, click) is silently ignored. Tab is never
intercepted so users can leave the control.

## Contrast computation

The selected-swatch indicator color (`black` or `white`) is derived from the swatch's WCAG
relative luminance, crossing over at L ≈ 0.179 (not the naïve 0.5 midpoint). Alpha is
ignored — the indicator is chosen against the swatch's intended solid color, not its
composite with whatever surface sits behind it, matching Hero UI's behavior and staying
stable across dark/light themes.

## Alpha checkerboard

Alpha-bearing swatches (detected by parsing the `color` string's alpha channel) display a
CSS `conic-gradient`/`linear-gradient` checkerboard behind the color so transparency is
visible without a DOM dependency. Alpha detection is regex-based — no `<canvas>` — so it
works in SSR and avoids a per-swatch off-screen canvas cost.

**Supported alpha detection:** `#rgba`, `#rrggbbaa`, `rgba(...)`, `hsla(...)`.
**Not supported:** modern space-separated syntax, `color()`, `lab()`, `oklch()`, named
colors. These render via CSS but receive no checkerboard and a best-effort `'white'`
indicator that may be invisible on near-white unsupported colors.

## Reduced motion

Hover and focus-visible scale transforms are gated behind
`@media (prefers-reduced-motion: no-preference)`. Users who have opted out of animations
see instant, non-animated state changes. There is no JS-side branching for reduced motion —
the contract lives entirely in the CSS media query, reviewed in the PR diff and visually
verified manually. jsdom does not honor media queries so automated tests do not cover this.
