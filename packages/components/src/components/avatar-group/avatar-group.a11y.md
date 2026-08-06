# AvatarGroup · accessibility

## Pattern

AvatarGroup presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Overlapping collaborator avatar stack built on the Avatar primitive with focusable names and overflow count.

## Use when

- Showing who is present, assigned, or collaborating in a compact surface.
- Summarizing a bounded set of people with a visible overflow count.

## Avoid when

- Rendering a single person — use avatar instead.
- Showing status, counts, or metadata labels unrelated to people — use badge, chip, or status-dot instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle AvatarGroup, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When AvatarGroup accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render AvatarGroup in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `avatar`, `badge`, `tooltip`, `status-dot`.

## Tooltip Anchoring and List Semantics

Each named avatar's Tooltip is rendered OUTSIDE the `role="list"` element and
anchored to its trigger via `TooltipProps.triggerRef`.

A wrapping Tooltip renders its `role="tooltip"` panel as a sibling of the
trigger, so nesting it inside the `role="listitem"` put a tooltip inside a list
item. That was invisible while Tooltip unconditionally portaled its panel to
`document.body`; it surfaced once the portal became visibility-gated, because a
hidden panel is now restored inline rather than left detached.

Anchoring by reference keeps the invariant this component's tests assert: every
direct child of the list is a `role="listitem"`, and no `role="tooltip"` is a
descendant of one.

**Accessibility review: REQUIRED and OUTSTANDING.** A reviewer should confirm
with a screen reader that the list still announces only its avatars as list
items, and that each avatar's name is still announced on focus.
