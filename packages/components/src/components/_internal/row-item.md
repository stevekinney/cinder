# Shared row-item boundary

`cinder-_row-item` owns the common flex-row geometry, minimum inline size, active/selected state fill, keyboard-cursor ring, disabled state, and forced-colors fallback for option-like rows.

## Composition map

- `dropdown-item`, `command-item`, and `navigation-item` compose the boundary directly. `side-navigation-item` composes it transitively through `navigation-item`.
- `selectable-row` is excluded because its root grid preserves full-row hover while its primary action and trailing controls remain independent siblings; applying a flex row would break wrap alignment.
- `stacked-list-item` is excluded because its leading/body/trailing grid changes columns and areas at a container breakpoint.
- `grid-list-item` is excluded because it is a card cell with stretched-link hover and image geometry, not an option row.
- `choice-grid-item` is excluded because its centered, fixed-height answer tile and feedback states intentionally override row alignment and state colors.
- `tree-item` is excluded because its row is nested inside a hierarchical item and owns disclosure, selection, drag, rename, and drop-target state styling.
