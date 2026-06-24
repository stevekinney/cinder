# SectionHeading · accessibility

## Pattern

SectionHeading styles text content. Keep the underlying text meaningful, avoid using visual style as the only semantic cue, and preserve heading or label structure outside the component when needed.

Purpose: Section header that renders a leveled heading with optional eyebrow label, description, actions, and tabs row.

## Use when

- Introducing a top-level section of a page with a title and supporting metadata.
- Pairing a section title with inline actions or a tab row beneath the heading.

## Avoid when

- Labelling a single form control or field — use label instead.
- Rendering a page-wide header with primary navigation — use a hand-rolled page scaffold with a heading element.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle SectionHeading, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When SectionHeading accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render SectionHeading in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `card`, `tab-list`.
