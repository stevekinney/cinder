# StackedListItem — Accessibility Notes

## Pattern

`StackedListItem` is a presentational row primitive that renders a single `<li>`. It **must** be placed inside a consumer-owned `<ul role="list">` (or `<ol>` for ordered/chronological content). The component owns the `<li>`; the consumer owns the parent list element.

```svelte
<ul role="list">
  <StackedListItem title={myTitleSnippet} />
  <StackedListItem title={myTitleSnippet} />
</ul>
```

> [!NOTE] Incompatibility with DataList
> `DataList` wraps its children in a `<div>`, making it an invalid parent for `StackedListItem` — `<li>` children inside a `<div>` is invalid HTML. Do not compose these two components together.

## Roles, Names, States

- **Root element (`.cinder-stacked-list-item`)**: Renders as `<li>`. List item role is provided implicitly by the element. No `role` override is applied or forwarded.
- **Title region (`.cinder-stacked-list-item__title`)**: Plain `<div>` when `href` is absent; wraps an `<a>` when `href` is supplied. The anchor is the focusable, interactive element — not the row itself.
- **Leading region (`.cinder-stacked-list-item__leading`)**: Purely visual by default. Consumer controls semantics of the child (e.g., `Avatar` with a `name` prop, or `aria-hidden="true"` on decorative icons).
- **Trailing region (`.cinder-stacked-list-item__trailing`)**: Consumer-supplied interactive controls (buttons, dropdown triggers, chevron icons). Each control must have its own accessible name.

## No Interactive `<li>`

`StackedListItem` does not attach event handlers to the `<li>` element, and consumers must not add them either. The ARIA `listitem` role has no interactive semantics — assistive technologies do not reliably announce interactive list items, and keyboard users would encounter an extra focus stop with no associated action.

All interaction lives inside child elements:

- **Navigation:** via the `title` link when `href` is supplied.
- **Actions:** via controls placed in the `trailing` snippet.

If you need the entire row to be clickable, wrap the row in an explicit interactive element rather than attaching `onclick` to the `<li>`.

## Disambiguated Action Labels

When the `trailing` snippet contains interactive controls — "Edit", "Delete", "View", etc. — the accessible name of each control must identify the specific row. Screen readers reading row-by-row otherwise announce a stream of identical button labels, violating [WCAG 2.4.6 Headings and Labels](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html) and [WCAG 2.4.4 Link Purpose in Context](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html).

```svelte
{#snippet trailing()}
  <!-- imports and props… -->
  <Button aria-label={`Edit ${person.name}`}>Edit</Button>
{/snippet}
```

The snippet receives no automatic row context — the consumer is responsible for capturing the row's identity in the surrounding `{#each}` block and threading it into the `trailing` snippet.

## Linkified Rows

When `href` is set, the title anchor is the primary focusable element representing the row's destination. Focus order within the row is: title link → any trailing controls (left-to-right in DOM order). This component intentionally does **not** implement the stretched-link pattern (where the entire row surface area is the click target) because that pattern conflicts with independently activatable trailing controls.

If `trailing` contains interactive elements alongside a linked title, both are separately reachable via keyboard. Ensure both have distinct, disambiguated accessible names.

## Density and Touch Target Size

`StackedListItem` exposes `density="comfortable"` (default) and `density="condensed"`. Both affect row padding only — the `trailing` slot's own dimensions are untouched by the density setting.

The component cannot enforce minimum touch target sizes on `trailing` content because that region is consumer-supplied markup. Two separate WCAG criteria apply:

- **[WCAG 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)** — Level AA — requires at least 24×24 CSS pixels, with documented exceptions and a spacing allowance for smaller targets. This is the **baseline**.
- **[WCAG 2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)** — Level AAA — recommends at least 44×44 CSS pixels for pointer-input targets. This is the **recommendation** for comfortable interaction.

Condensed density reduces row padding; it does not reduce trailing control dimensions. Consumers must ensure their trailing controls independently satisfy the applicable target size criterion.

## Leading Content Semantics

The `leading` snippet is not automatically hidden from assistive technologies. If the leading slot contains an avatar that identifies the same person as the row title:

- Either supply a `name` prop to `Avatar` (which provides a visible accessible name), _or_
- Apply `aria-hidden="true"` to the `Avatar` when the title already communicates the identity and the leading visual is purely decorative.

Duplicating identity information is acceptable and sometimes preferred — it makes the row easier to scan with a screen reader. Hiding it is only correct when the title already provides a complete, unambiguous label.

## Reading Order and Container Queries

The responsive layout (trailing dropping below body at narrow widths) is purely visual — implemented via CSS container queries on the `<li>`. DOM order is always `leading → title → description → meta → trailing`, regardless of how the grid re-flows at narrow container widths. Screen readers follow DOM order, so the reading sequence is stable and predictable across all breakpoints.

## Animation and Motion

`StackedListItem` does not apply any transition or animation by default, so there is nothing to suppress for users who prefer reduced motion. Consumers who add hover or focus animations via the `class` prop should wrap those styles in `@media (prefers-reduced-motion: no-preference)` to respect user system preferences.
