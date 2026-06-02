# DataList — Accessibility Notes

## Semantic structure

DataList renders a `<ul role="list">`. The `role="list"` attribute is stated
explicitly because browsers that apply `list-style: none` (for example via a
CSS reset) may strip the implicit list role in Safari/VoiceOver, causing the
element to be announced as a group instead of a list.

```html
<ul role="list" class="cinder-data-list">
  <!-- each row rendered by children(entry) must be an <li> -->
  <li class="cinder-stacked-list-item">...</li>
</ul>
```

## Child contract

Every element produced by the `children` snippet must be a valid `<li>` so the
`<ul>` has a valid DOM structure. [`StackedListItem`](../stacked-list-item/README.md)
is the recommended row: it renders an `<li>` with leading/title/description/
meta/trailing slots. Do not render `<div>`, `<span>`, or arbitrary fragments
directly inside DataList — doing so creates invalid HTML.

## Accessible naming

DataList does not supply an accessible name for the list. Consumers are
responsible for labelling the list through one of:

- An immediately-preceding heading (the most common approach; screen readers
  associate the preceding heading in the reading order):
  ```svelte
  <h2 id="team-heading">Team members</h2>
  <DataList aria-labelledby="team-heading" items={members}>
  ```
- An `aria-label` prop passed via `class` (DataList forwards `{...rest}` — pass
  `aria-label` directly):
  ```svelte
  <DataList aria-label="Team members" items={members}>
  ```

Without a visible or programmatic label, screen reader users navigating by list
shortcuts land on an unnamed list.

## Empty state

When `items` is empty and an `empty` snippet is provided, the empty content is
wrapped in a single `<li class="cinder-data-list-empty">`. This keeps the
`<ul>` structurally valid (a list with one item announces normally) and means
screen readers read the empty state as a list item — for example: "list,
1 item, No team members yet, end of list."

## Keyboard and focus

DataList is a static, non-interactive list container. It applies no `tabindex`,
`role`, or keyboard handling. Focus management is the responsibility of
interactive controls inside each row (for example, an anchor in StackedListItem
or a button in a trailing slot).

## Row dividers

DataList does not draw row dividers. Dividers are owned by the row primitive
(`StackedListItem` uses `border-bottom`). Do not add a top or bottom border to
DataList rows outside the row component — that would double the separator.

## Composing with StackedListItem

See [`stacked-list-item.a11y.md`](../stacked-list-item/stacked-list-item.a11y.md)
for the row-level accessibility contract, including title-region roles,
trailing-control naming, and the link/href pattern.
