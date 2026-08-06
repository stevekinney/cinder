# ScrollArea · accessibility

## Pattern

ScrollArea affects structure rather than meaning. Use it without removing headings, landmarks, labels, or reading order from the content it contains.

Purpose: Bounded scrolling container that constrains overflowing content within a max height or width while remaining keyboard-focusable.

## Use when

- Containing a long list or large block of content inside a fixed-size region.
- Preserving keyboard scrollability for overflow content in a card or surface.

## Avoid when

- Wrapping the entire page — let the document scroll natively.
- Hiding overflow without scrollbars — use plain CSS overflow utilities instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle ScrollArea, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ScrollArea accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## `dragToScroll` (fine-pointer drag-to-scroll)

> **Review status: AI-authored, not yet human-reviewed.** This shares the
> `useDragScroll` engine and the same self-review documented in Carousel's
> `carousel.a11y.md` ("Fine-pointer drag-to-scroll review"); read that for
> the full mechanics. The points specific to ScrollArea:

- **Off by default.** `dragToScroll` defaults to `false` — click-and-drag on
  a text-bearing pane is a preference, not something every consumer of a
  generic scroll container should get for free (it visually and
  behaviorally competes with ordinary text selection). Native keyboard
  scrolling (arrow keys, Page Up/Down, Home/End) works identically whether
  or not `dragToScroll` is set.
- **Not supported when `direction` is `'both'`.** The engine drags one axis;
  a 2D pan is out of scope for v1. Setting `dragToScroll` with
  `direction="both"` is a no-op with a dev-only warning, not a silent
  partial behavior.
- **Mouse-only, gated the same way as Carousel:** `(hover: hover) and
(pointer: fine)` plus `!prefersReducedMotion`. Touch and pen keep their
  native panning untouched.
- **`user-select: none` is scoped to `[data-cinder-dragging] *`** inside
  this specific scroll area, active only during a real drag — text
  selection elsewhere on the page, and in this scroll area when not
  dragging, is unaffected.

## Verification

- Render ScrollArea in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

## scrollFadeVisible (Tier 3 polish)

`scrollFadeVisible` paints an opaque scroll-driven edge fade (never a `mask-`,
see `_scroll-fade.css`) on the trailing edge of `direction`. It is
presentation-only and is never the sole signal that content scrolls — the
native scrollbar this component always renders (never substituted) remains
the authoritative affordance regardless of this prop. It does not change
keyboard behavior, focus order, or the accessible name/role established
above. `@media (forced-colors: active)` disables the fade outright, since
custom properties are not forced and a themed band would otherwise persist
on a high-contrast surface. Reviewed against the design rules in
`_scroll-fade.css`'s doc comment (never mask, never fade a sticky/focusable/
text-entry edge); ScrollArea's own content is caller-owned, so those
per-content risks (a focused item at the edge, a text-entry field) are the
caller's to avoid, same as any other layout decision about what to place
inside ScrollArea.

Related components: `surface`.
