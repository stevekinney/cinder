# Stat — Accessibility Notes

## ARIA Roles and Attributes

### Root element (`.cinder-stat`)

- **`role="group"`** with **`aria-labelledby`** pointing at both the label span's `id` and the value span's `id`.
  - This makes the accessible name read as one unit — e.g., "Monthly Revenue 1,234,567" — so a screen reader user hears label and value together when navigating into the group.
  - Using `aria-label={label}` alone would hide the value from the accessible name, which is the wrong tradeoff for a statistic widget.
  - IDs are generated via a counter (`useId`) so each instance is unique even when multiple stats share the same label. When you need a specific, predictable ID (e.g. for testing or for `aria-describedby` cross-references from another element), pass an explicit `id` prop — this overrides the auto-generated value and is forwarded as the base for all internal element IDs.
  - **ID collision avoidance:** If you render two `<Stat label="Revenue">` components on the same page without passing `id`, the counter guarantees distinct IDs. But if you need deterministic, human-readable IDs (e.g. `"summary-revenue"` and `"detail-revenue"`), pass them explicitly so your tests and any external `aria-describedby` references remain stable.
  - Labels may be empty, whitespace-only, or contain punctuation without breaking internal ID generation because `label` is not used to build DOM IDs. Consumers should still provide meaningful visible labels because the label text is part of the group's accessible name.

### Change indicator (`.cinder-stat__change`)

- **Worded accessible text** is rendered as a `<span class="cinder-sr-only">` child, not as `aria-label` on the span.
  - `aria-label` on non-interactive generic elements (`<span>`) is not reliably exposed by all assistive technologies. A visually-hidden child element enters the accessibility tree as ordinary text and is universally supported.
  - The worded text is synthesized from `change.direction` + `change.value` + optional `change.description`:
    - `up` → "increased by {value}" (+ " {description}" if provided)
    - `down` → "decreased by {value}" (+ " {description}")
    - `neutral` → "no change, {value}" (+ " {description}")
  - When `change.ariaLabel` is provided by the caller, it is used verbatim and the caller owns the full wording.
- The glyph (↑/↓/→), visible value, and description spans are all **`aria-hidden="true"`** so only the worded sr-only text is announced — no duplication of meaning.

### Icon snippet (`.cinder-stat__icon`)

- The icon wrapper carries **`aria-hidden="true"`**. The icon is decorative — its meaning is already conveyed by the `label` prop. If a consumer needs the icon to carry unique meaning, that meaning should be encoded in `label` instead.

## Non-Color Channel

The visible change indicator combines an arrow glyph with a directional color. The color reinforces the direction but is not the sole signal — the glyph provides a non-color channel. The sr-only worded text provides the third channel for assistive technology users.

Consumers who restyle the component should preserve at least one non-color channel (glyph or other shape) in the visible change indicator.

## Motion

The v1 component does not animate value or change transitions. Future animation work should respect reduced-motion preferences with CSS media queries or the shared `useReducedMotion()` utility for client-side behavior.

## Value as Plain Text

The `value` prop is `string | number`. The stat primitive intentionally does not contain interactive affordances (tooltips, popovers, drill-downs) — those live on sibling elements outside this primitive.

## Possible Duplication During Screen-Reader Navigation

`aria-labelledby` referencing visible text means some traversal modes may re-announce the label and value both as the group's accessible name and again as individual text nodes when the user navigates inside the group. This pattern (group named from visible label + value) is the WAI-ARIA Authoring Practices–recommended approach for statistic widgets and is generally well-tolerated in practice. If duplication is problematic in a specific deployment, adding `aria-hidden="true"` to one of the referenced spans is a follow-up mitigation — it is not part of the v1 contract.
