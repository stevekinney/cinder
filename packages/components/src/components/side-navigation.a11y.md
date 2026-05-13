# SideNavigation Accessibility Notes

## Landmark labeling

`SideNavigation` renders a `<nav aria-label="…">` landmark. The `ariaLabel` prop is required and validated at runtime — an empty string throws during render so a blank label never reaches the DOM.

The label must be distinct from every other `<nav>` on the page. When a `NavigationBar` is present (which uses `"Main navigation"`), use a different label for the sidebar: `"Sections"`, `"Workspace"`, `"Project"`, or similar. Screen readers expose multiple nav landmarks in the landmark rotor; identical labels collapse them, making navigation ambiguous for assistive technology users.

## Section header role decision

`SideNavigationGroup` uses a plain `<button type="button">` as the disclosure trigger rather than wrapping it in a heading element (`<h2>`, `<h3>`). Rationale:

- A sidebar section label is UI chrome for a navigation list, not a document outline entry. Wrapping it in a heading would inject spurious items into the screen-reader heading list and confuse the document structure.
- The nested `<ul>` carries its accessible name via `aria-labelledby` pointing at the trigger's `id`. This is the WAI-ARIA Authoring Practices recommended approach for a "labeled list" pattern — the group label is conveyed to AT through list labeling, not through heading semantics.

## Disclosure pattern

Follows WAI-ARIA APG [Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/):

- `aria-expanded` on the trigger reflects open/closed state.
- `aria-controls` on the trigger points at the disclosed `<ul>`'s `id`.
- The disclosed region uses the `hidden` attribute (not a CSS class) when collapsed. `hidden` is equivalent to `display: none` at the layout level, which means the browser and all assistive technologies consistently exclude collapsed children from focus order and the accessibility tree — no extra ARIA is needed to enforce this.

## Keyboard model

This is a navigation landmark containing links and disclosure buttons — it is **not** a composite widget like `tablist` or `menubar`.

| Key                 | Behavior                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `Tab` / `Shift-Tab` | Moves focus between interactive elements: disclosure triggers and visible navigation items. |
| `Enter` / `Space`   | Activates the focused disclosure trigger (toggles expand/collapse).                         |
| `Enter` on a link   | Follows the link.                                                                           |

We deliberately do **not** implement roving tabindex or arrow-key navigation. WCAG SC 2.1.1 and the APG explicitly differentiate list-of-links navigation (where Tab is correct) from composite widgets (where arrow keys are expected). Sidebar navigation falls in the former category.

## Generated IDs and SSR

`useId` is a process-wide counter. If server-side rendering produces a different render order than the client, IDs may diverge (hydration mismatch). This matches every existing consumer in this library (`AccordionItem`, etc.) and is acceptable for current usage. Consumers who need stable IDs should pass the `id` prop explicitly.

## Forced-colors mode

The `SideNavigationGroup` trigger uses a `box-shadow`-based focus ring consistent with `NavigationItem`. In forced-colors mode (Windows High Contrast), `box-shadow` is suppressed by the browser. The CSS provides a `@media (forced-colors: active)` fallback that uses a real `outline: var(--cinder-ring-width) solid ButtonText` instead, keeping focus indicators visible.

## Motion

The chevron rotation transition is controlled by `--cinder-duration-fast`. The `@media (prefers-reduced-motion: reduce)` block in `side-navigation-group.css` sets `transition: none` so users who have opted out of motion see an instant state change. Panel show/hide is instant by default (via `hidden` attribute, which cannot be animated) — no motion reduction override is needed for the panel.

## Required prop discipline

`SideNavigation` does not fall back to any default `aria-label` string, because every default would be wrong in at least some context. The TypeScript type enforces `ariaLabel` at compile time; the runtime validation ensures nothing slips through in untyped JS consumers.
