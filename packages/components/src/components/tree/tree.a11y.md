# Tree · accessibility

## ARIA Roles and Attributes

The tree implementation follows the [WAI-ARIA Tree pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).

### Tree root

- `role="tree"` — identifies the container as a tree widget.
- `aria-label` or `aria-labelledby` — required. The component emits `console.warn` once per mount (with `[cinder-tree]` prefix) when neither is provided, in both development and production builds. No synthetic fallback label is invented.
- `aria-multiselectable="true"` — present only when `selectionMode="multiple"`. Omitted in `'none'` and `'single'` modes.

### TreeItem nodes

- `role="treeitem"` — each node in the tree.
- `aria-level={n}` — 1-based nesting depth. Direct children of the tree root are level 1; each nested group increments by one.
- `aria-expanded="true|false"` — present **only on branch nodes** (those with `branch={true}` or a `loadChildren` prop). Intentionally omitted on leaf nodes. Setting this attribute on leaves is a known accessibility bug this component avoids.
- `aria-selected="true|false"` — present on every item when `selectionMode` is `'single'` or `'multiple'`, except checkbox-selection mode where `aria-checked` owns the selection state. Omitted entirely in `'none'` mode. Assistive technologies announce "selected" alongside the item name.
- `aria-checked="true|false|mixed"` — present only when `checkboxSelection={true}` and `selectionMode="multiple"`. The treeitem owns the semantic checked state; the visual checkbox is hidden from assistive technologies.
- `aria-busy="true"` — set on the `role="treeitem"` element of the actively-loading branch (not on the whole tree). Cleared when the async loader resolves or is cancelled.
- `aria-disabled="true"` — present when `disabled={true}`. Per the Disabled Items section below, disabled items remain keyboard-reachable.
- `aria-labelledby` — points at a visually-hidden label span generated from `label`. This keeps the treeitem's accessible name aligned with the typeahead key without requiring custom row snippets to hide their visible text.

### Nested item groups

- `role="group"` — wraps the child items inside an expanded branch. This communicates the hierarchical relationship to assistive technologies without introducing native list semantics (`<ul>`/`<li>`) alongside ARIA tree roles. The tree uses `<div role="tree">` and `<div role="treeitem">` exclusively — no `<ul>`, `<ol>`, or `<li>` elements.

## Keyboard Interactions

| Key                                     | Behavior                                                                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ArrowDown`                             | Move focus to the next visible item. No wrap at the last item.                                                                                                                         |
| `ArrowUp`                               | Move focus to the previous visible item. No wrap at the first item.                                                                                                                    |
| `ArrowRight` (branch, collapsed)        | Expand the node. Focus stays on the branch.                                                                                                                                            |
| `ArrowRight` (branch, expanded)         | Move focus to the first child.                                                                                                                                                         |
| `ArrowRight` (leaf)                     | No-op.                                                                                                                                                                                 |
| `ArrowLeft` (branch, expanded)          | Collapse the node. Focus stays on the branch.                                                                                                                                          |
| `ArrowLeft` (branch, collapsed or leaf) | Move focus to the parent node. No-op at root level.                                                                                                                                    |
| `Home`                                  | Move focus to the first visible item.                                                                                                                                                  |
| `End`                                   | Move focus to the last visible item.                                                                                                                                                   |
| `Enter`                                 | If `selectionMode !== 'none'`: toggle selection. If branch: also toggle expand. In checkbox-selection mode, branch `Enter` only toggles expand and leaf `Enter` toggles checked state. |
| `Space`                                 | Toggle selection or checked state. Does **not** toggle expand on branches per APG guidance.                                                                                            |
| `*` (asterisk)                          | Expand all sibling branches at the current level.                                                                                                                                      |
| Printable character                     | Typeahead: focus the next visible item whose label starts with the buffered string (case-insensitive). Buffer resets after 500 ms. Disable per-tree via `disableTypeahead`.            |
| `Shift+ArrowUp/Down`                    | Multi-select only: select the current anchor-to-current range, then move focus one item.                                                                                               |
| `Ctrl/Cmd+A`                            | Multi-select only: select all currently visible, non-disabled items.                                                                                                                   |

In checkbox-selection mode, keyboard focus remains on the `role="treeitem"` element. The tree-generated checkbox is a visual indicator with `tabindex="-1"` and `aria-hidden="true"`, so it does not add a second tab stop inside the tree.

## Focus Management

- **Roving tabindex:** Exactly one `role="treeitem"` element carries `tabindex="0"` at any time. All others carry `tabindex="-1"`. This keeps the tree as a single tab stop; arrow keys move between items.
- **Initial focus:** When no explicit focus has been set, the first selected visible item gets `tabindex="0"` (if `selectionMode !== 'none'` and `selectedIds` is non-empty); otherwise the first visible item does. This matches the APG recommendation.
- **Click:** Clicking an item sets `focusedId` and DOM-focuses the outer `role="treeitem"` element.
- **Keyboard navigation:** Updates `focusedId` and calls `focus()` on the resolved registration, which focuses the outer treeitem element.
- **Item unmounts:** If the focused item unregisters (e.g. its parent collapses), DOM focus moves to the visible parent when possible, then to the first selected visible item, then to the first visible item, then null.

## Disabled Items

A `disabled` item:

- Carries `aria-disabled="true"` on its `role="treeitem"` element.
- **Remains focusable via keyboard navigation** — APG guidance says disabled items should still be discoverable so users know they exist.
- Does **not** participate in selection — click, `Enter`, and `Space` do not select the item.
- Is **not** skipped by typeahead.
- For branches: arrow-key expand/collapse, `Enter`, and plain-click branch toggling still work. `disabled` means "cannot be selected," not "frozen."

This is a deliberate departure from the flat-widget `roving-tabindex.ts` helper, which skips disabled items. That skip semantic suits menus and tabs but not trees.

## Selection Models

| Mode         | `aria-multiselectable` | `aria-selected`         | Interaction                                                                                                 |
| ------------ | ---------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `'none'`     | omitted                | omitted                 | Selection state not updated.                                                                                |
| `'single'`   | omitted                | present; `true`/`false` | Toggles the current id; selecting a different item clears the previous selection.                           |
| `'multiple'` | `"true"`               | present; `true`/`false` | Toggles current id. `Shift` extends range. `Ctrl/Cmd` toggles individual. `Ctrl/Cmd+A` selects all visible. |

`selectedIds` is always an array (length 0–1 in single mode, 0–N in multiple). Disabled items are never added.

### Checkbox selection

`checkboxSelection` is opt-in and only active with `selectionMode="multiple"`. In `none` or `single` mode, enabling it renders no tree-generated checkbox inputs and preserves the normal non-checkbox selection behavior.

When active, default `TreeItem` rows render a native checkbox indicator. That input mirrors the resolved checked and indeterminate state, but it is not the accessibility owner. The outer treeitem exposes `aria-checked`, including `mixed` for partial selection. Custom `row` snippets receive `checkboxSelection`, `selectionState`, and `toggleSelection` so consumers can render their own checkbox without getting a duplicate tree-generated control.

`selectionBehavior="independent"` keeps the existing flat toggle behavior: activating a branch toggles only that branch id. `selectionBehavior="cascade"` toggles the branch's selectable scope. By default, that scope is the registered descendant ids plus the current item id. Collapsed and async children are not registered while unmounted, so consumers that need full data-model cascade behavior should pass `selectionScopeIds` on the branch. Disabled registered ids are filtered out of cascade and select-all updates.

`TreeSelectAll` provides explicit select-all and select-none actions for a tree level. It is rendered through `Tree`'s `selectionControls` snippet so the buttons sit outside the `role="tree"` element. `parentId={null}` targets root-level items; a string `parentId` targets direct registered children of that item. `includeDescendants` expands the target set through each child's selectable scope.

## Async Loading

When `loadChildren` is provided, `aria-busy="true"` is set on the outer `role="treeitem"` while the load is in progress. Assistive technologies announce the busy state for the whole item. Once the load resolves, `aria-busy` is cleared. If the load fails or the branch is collapsed before it resolves, `aria-busy` is cleared without announcing a success.

## Typeahead

Typeahead is part of the APG tree pattern. When a printable character is pressed:

1. The character is appended to an in-memory buffer.
2. The registry scans visible items forward from the current focus, looking for one whose label starts with the buffer (case-insensitive).
3. If found, that item is focused.
4. The buffer resets 500 ms after the last keystroke.

Multi-character sequences allow users to jump to "ap" before "apple" rather than landing on "aardvark." Typeahead can be disabled per-tree via the `disableTypeahead` prop.

## Virtualization and Performance

The visible-order list is recomputed via DFS over a `parentId → orderedChildIds[]` adjacency map on every expand/collapse. This is O(N) per recompute; acceptable for N < ~2000 items. For very large trees, virtualization is out of scope for v1.

## SSR / Hydration

The tree renders correctly server-side with `focusedId === null`. The initial roving tabindex is set via `$derived` from the registered items and expansion state, without any DOM focus calls. Focus is only moved on explicit user interaction (click or keydown), never on mount.
