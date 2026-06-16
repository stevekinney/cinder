# Tree

Hierarchical tree view for navigating or selecting nested data structures.

## Usage

`Tree` is a compound component. Import the parent and compose `Tree.Item` via
the namespace API.

```svelte
<script lang="ts">
  import { Tree } from '@lostgradient/cinder/tree';

  let expandedIds = $state<string[]>(['fruit']);
</script>

<Tree aria-label="Pantry" bind:expandedIds>
  <Tree.Item id="fruit" label="Fruit" branch>
    <Tree.Item id="apple" label="Apple" />
    <Tree.Item id="banana" label="Banana" />
  </Tree.Item>
  <Tree.Item id="grain" label="Grain" branch>
    <Tree.Item id="rice" label="Rice" />
  </Tree.Item>
</Tree>
```

The leaf remains importable individually for à-la-carte builds — see
`@lostgradient/cinder/tree-item`.

## Props

<!-- generated:props:start -->

| Prop                               | Type                                   | Required | Default | Description                                                                                                                                                  |
| ---------------------------------- | -------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aria-label`                       | `string`                               | no       | —       | Accessible label for the tree. One of aria-label or aria-labelledby is required.                                                                             |
| `aria-labelledby`                  | `string`                               | no       | —       | The `id` of a visible element whose text serves as the accessible label for the tree. One of `aria-label` or `aria-labelledby` is required.                  |
| `checkboxSelection`                | `boolean`                              | no       | —       | Render tree-owned checkbox indicators when selectionMode is multiple. Default: false.                                                                        |
| `class`                            | `string`                               | no       | —       | Additional CSS class merged with `.cinder-tree`.                                                                                                             |
| `disableTypeahead`                 | `boolean`                              | no       | —       | Disable typeahead. Default: false.                                                                                                                           |
| `expandedIds`                      | `string`[]                             | no       | —       | Currently expanded branch ids. Bindable.                                                                                                                     |
| `filterPlaceholder`                | `string`                               | no       | —       | Placeholder and accessible label for the built-in search input. Default: 'Search tree'.                                                                      |
| `filterValue`                      | `string`                               | no       | —       | Controlled filter query. When provided, matching is driven by this value.                                                                                    |
| `selectedIds`                      | `string`[]                             | no       | —       | Currently selected node ids. Bindable.                                                                                                                       |
| `selectionBehavior`                | `"independent"` \| `"cascade"`         | no       | —       | Select only the target item or cascade through its selectable scope. Default: 'independent'.                                                                 |
| `selectionMode`                    | `"none"` \| `"single"` \| `"multiple"` | no       | —       | Selection model. Default: 'none'.                                                                                                                            |
| `showSearch`                       | `boolean`                              | no       | —       | Render the built-in search input before the role="tree" element. Default: false.                                                                             |
| `virtualizationEstimatedRowHeight` | `number`                               | no       | —       | Estimated row height for virtualized Tree rows. Default: 36.                                                                                                 |
| `virtualizationHeight`             | `string` \| `number`                   | no       | —       | Block size for the virtualized scroll viewport. Default: '20rem'.                                                                                            |
| `virtualizationOverscan`           | `number`                               | no       | —       | Extra rows rendered before and after the viewport. Default: 4.                                                                                               |
| `virtualized`                      | `boolean`                              | no       | —       | Use the data-driven virtualized render path for large trees. Default: false.                                                                                 |
| `children`                         | `(opaque)`                             | no       | —       | Tree items (snippet). Not expressible in JSON Schema; see the component types for the signature.                                                             |
| `filterPredicate`                  | `(opaque)`                             | no       | —       | Custom filter predicate. Default: case-insensitive label substring matching. Not expressible in JSON Schema; see the component types for the signature.      |
| `items`                            | `(opaque)`                             | no       | —       | Data-driven Tree items. Required when virtualized is true. Not expressible in JSON Schema; see the component types for the signature.                        |
| `onFilterChange`                   | `(opaque)`                             | no       | —       | Fires whenever the built-in search input changes the filter query. Not expressible in JSON Schema; see the component types for the signature.                |
| `onReorder`                        | `(opaque)`                             | no       | —       | Called when a draggable item is dropped before, after, or into another tree item. Not expressible in JSON Schema; see the component types for the signature. |
| `ref`                              | `(opaque)`                             | no       | —       | Typed programmatic handle. Use `bind:ref` to receive it. Not expressible in JSON Schema; see the component types for the signature.                          |
| `selectionControls`                | `(opaque)`                             | no       | —       | Optional selection controls rendered before the role="tree" element. Not expressible in JSON Schema; see the component types for the signature.              |
| `virtualizedItem`                  | `(opaque)`                             | no       | —       | Optional custom virtualized row renderer. Not expressible in JSON Schema; see the component types for the signature.                                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-tree-drop-line-color`
- `--cinder-tree-drop-line-thickness`
- `--cinder-tree-item-dragging-opacity`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Tree.Item` — a tree node, branch or leaf; see [`tree-item`](../tree-item/README.md).
- `Tree.SelectAll` — the root-level select-all/none control. It reads Tree's
  selection context and is namespace-only: there is no standalone
  `@lostgradient/cinder/tree-select-all` import, because rendering it outside a Tree always
  throws.

<!-- generated:subcomponents:end -->
