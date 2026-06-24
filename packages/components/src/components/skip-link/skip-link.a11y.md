# SkipLink · accessibility

## Pattern

SkipLink helps users move through destinations or hierarchy. Keep link text and selected/current state accurate so keyboard and assistive-technology users get the same location cues as sighted pointer users.

Purpose: Visually hidden skip link that moves keyboard focus to a landmark element, letting keyboard and screen reader users bypass repeated navigation.

## Use when

- Providing a keyboard shortcut to jump past site-wide navigation directly to the main content area.
- Meeting WCAG 2.4.1 (Bypass Blocks) without adding visible chrome to the layout.

## Avoid when

- The page has no repeated navigation block — a skip link adds no value on single-panel layouts.
- The target region already receives focus naturally without intervention.

## Keyboard and focus

The browser tab order should follow visual order. Use current/selected state only for the destination or item that is actually current.

Keep focus indicators visible. If you wrap or restyle SkipLink, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When SkipLink accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render SkipLink in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `visually-hidden`.
