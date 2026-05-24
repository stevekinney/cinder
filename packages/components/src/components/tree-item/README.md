# TreeItem

A TreeItem component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`TreeItem` is a compose-only leaf of [`Tree`](../tree/README.md).
The idiomatic API is `Tree.Item`, reached through the parent
namespace — see the [tree README](../tree/README.md#usage) for the composed
snippet. The flat `cinder/tree-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                      |
| ------------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `branch`            | `boolean`  | no       | —       | Required to make a node behave as a branch. Without `branch` or `loadChildren`, the node is a leaf regardless of any `children` snippet. The children snippet's presence is NOT sufficient — see tree.svelte plan for rationale. |
| `class`             | `string`   | no       | —       | Additional CSS class merged with `.cinder-tree-item`.                                                                                                                                                                            |
| `disabled`          | `boolean`  | no       | —       | When true, the item cannot be selected or actioned. Still keyboard-reachable.                                                                                                                                                    |
| `id`                | `string`   | yes      | —       | Stable unique id within the tree.                                                                                                                                                                                                |
| `label`             | `string`   | yes      | —       | Accessible name for the item. Also used as the typeahead key.                                                                                                                                                                    |
| `selectionScopeIds` | `string`[] | no       | —       | Explicit selectable ids controlled by this item in cascade checkbox-selection mode.                                                                                                                                              |
| `children`          | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                              |
| `loadChildren`      | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                              |
| `onLoadError`       | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                              |
| `row`               | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
