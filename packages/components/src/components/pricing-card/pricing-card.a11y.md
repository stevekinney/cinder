# PricingCard · accessibility

## Pattern

PricingCard presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Presents a single pricing plan with its name, price, feature list, and a call-to-action button.

## Use when

- Letting users compare and select subscription tiers or product plans.
- Highlighting one tier as selected or recommended in a pricing comparison.

## Avoid when

- Showing generic grouped content without a distinct price or CTA — use card instead.
- Displaying a single key metric in isolation — use stat or stat-group instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle PricingCard, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When PricingCard accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render PricingCard in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `card`, `button`, `stat`, `stat-group`.
