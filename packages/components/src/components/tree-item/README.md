# TreeItem

Expandable or leaf node within a tree view for hierarchical data navigation.

## Usage

`TreeItem` is a compose-only leaf of [`Tree`](../tree/README.md).
The idiomatic API is `Tree.Item`, reached through the parent
namespace — see the [tree README](../tree/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/tree-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `branch`            | `boolean`  | no       | —       | Marks the node as an expandable branch. A node is a leaf unless it sets `branch` or `loadChildren`; supplying a `children` snippet alone is not enough. Declaring branch-ness explicitly lets the tree render the correct expand affordance and `aria-expanded` state before any children exist (for example, before an async `loadChildren` resolves). |
| `class`             | `string`   | no       | —       | Additional CSS class merged with `.cinder-tree-item`.                                                                                                                                                                                                                                                                                                   |
| `disabled`          | `boolean`  | no       | —       | When true, the item cannot be selected or actioned. Still keyboard-reachable.                                                                                                                                                                                                                                                                           |
| `id`                | `string`   | yes      | —       | Stable unique id within the tree.                                                                                                                                                                                                                                                                                                                       |
| `label`             | `string`   | yes      | —       | Accessible name for the item. Also used as the typeahead key.                                                                                                                                                                                                                                                                                           |
| `selectionScopeIds` | `string`[] | no       | —       | Explicit selectable ids controlled by this item in cascade checkbox-selection mode.                                                                                                                                                                                                                                                                     |
| `children`          | `(opaque)` | no       | —       | Nested TreeItem children for branch nodes. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                   |
| `loadChildren`      | `(opaque)` | no       | —       | Async loader called the first time the item is expanded. Implies `branch=true`. The loader mutates consumer-owned reactive state; it returns no data. Errors are forwarded to `onLoadError` if provided, otherwise logged via `console.error` with a `[cinder-tree]` prefix. Not expressible in JSON Schema; see the component types for the signature. |
| `onLoadError`       | `(opaque)` | no       | —       | Called when `loadChildren` rejects with a non-abort error. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                   |
| `row`               | `(opaque)` | no       | —       | Optional row content snippet override. Default renders `label`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
