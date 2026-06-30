# PageHeader · accessibility

## Pattern

PageHeader organizes page-level heading content. Preserve heading semantics, keep metadata supplemental, and ensure action controls remain operable with keyboard and assistive technology.

Purpose: Page-level heading row that pairs a required title with optional metadata and optional trailing actions.

## Use when

- Rendering a route-level heading that needs consistent spacing and border treatment across pages.
- Showing high-level page metadata (counts or state summaries) beside a title with optional right-aligned controls.

## Avoid when

- Rendering section-scoped headings within page content — use section-heading.
- Building complex hero layouts with rich copy and media — use hero-section.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle PageHeader, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When PageHeader accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render PageHeader in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `section-heading`, `hero-section`.
