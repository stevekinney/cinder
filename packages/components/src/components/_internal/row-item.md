# Shared row-item boundary

`cinder-_row-item` owns the common flex-row geometry, minimum inline size, active/selected state fill, keyboard-cursor ring, disabled state, and forced-colors fallback for option-like rows.

## Composition map

- `dropdown-item`, `command-item`, and `navigation-item` compose the boundary directly. `side-navigation-item` composes it transitively through `navigation-item`.
- `combobox`, `autocomplete`, `multi-select`, and `transfer-list` compose the boundary via the `cinder-_option-row` alias on their listbox option rows. They keep component-level typography and `cursor: pointer`; `transfer-list` deliberately overrides the selected fill with `--cinder-surface-inset` (selection = staged-for-transfer must stay distinct from the keyboard cursor).

## Padding

The primitive owns the shared option-row padding (`--cinder-space-1-5` block / `--cinder-space-2` inline — deliberately tight), tuned once here. The menu/navigation composers keep their own roomier ergonomics by overriding it locally: `dropdown-item` pairs with `--cinder-control-height-lg`, `command-item` uses palette-row spacing, `navigation-item` its own block/inline pair. Padding is a plain declaration, not a custom property — a `--cinder-row-item-*` property would require a `SHARED_PARTIAL_OWNED_PREFIXES` registration and drift the generated variables artifacts.

- `selectable-row` is excluded because its root grid preserves full-row hover while its primary action and trailing controls remain independent siblings; applying a flex row would break wrap alignment.
- `stacked-list-item` is excluded because its leading/body/trailing grid changes columns and areas at a container breakpoint.
- `grid-list-item` is excluded because it is a card cell with stretched-link hover and image geometry, not an option row.
- `choice-grid-item` is excluded because its centered, fixed-height answer tile and feedback states intentionally override row alignment and state colors.
- `tree-item` is excluded because its row is nested inside a hierarchical item and owns disclosure, selection, drag, rename, and drop-target state styling.
