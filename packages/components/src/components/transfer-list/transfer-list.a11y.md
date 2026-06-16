# TransferList Accessibility

TransferList renders two `role="listbox"` elements with
`aria-multiselectable="true"`. Each option exposes `aria-selected`, and disabled
items expose `aria-disabled="true"` and are skipped by keyboard movement.

Keyboard behavior:

- Tab moves between the left list, transfer controls, and right list.
- Arrow Up and Arrow Down move the active option within the focused list.
- Home and End jump to the first or last enabled option.
- Space toggles the active option.
- Enter moves the selected items out of the focused list.

Move operations announce through a persistent assertive live region.
