# TreeView Multi-Select Gap Analysis

## Supported today

- `Tree` already supports `selectionMode="none" | "single" | "multiple"`, bindable `selectedIds`, bindable `expandedIds`, roving focus, typeahead, and visible-item range selection.
- `TreeItem` already supports custom `row` snippets, so consumers could render their own checkbox controls manually.
- `Checkbox` already supports native checked and indeterminate states.

## Gaps found

- Tree did not provide built-in per-node checkbox indicators.
- Tree did not compute parent checked or indeterminate state from a node selection scope.
- Tree selection was flat only; selecting a branch could not opt into selecting descendants.
- There was no first-class select-all or select-none affordance for a tree level.
- Collapsed and async children are not registered while unmounted, so registered-descendant fallback cannot fully represent hidden data-model descendants.

## Implementation chosen

- Added opt-in `checkboxSelection` and `selectionBehavior="independent" | "cascade"` props on `Tree`.
- Added `selectionScopeIds` on `TreeItem` so consumers can provide the complete selectable scope for collapsed or async descendants.
- Kept `selectedIds: string[]` as the only public selection state.
- Added `TreeSelectAll` for select-all and select-none controls rendered through `Tree`'s `selectionControls` snippet, outside the `role="tree"` element.
- Kept the default behavior unchanged unless the new props are explicitly enabled.
