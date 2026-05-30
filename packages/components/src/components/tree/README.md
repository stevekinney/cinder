# Tree

A Tree component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`Tree` is a compound component. Import the parent and compose `Tree.Item` via
the namespace API.

```svelte
<script lang="ts">
  import { Tree } from 'cinder/tree';

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
`cinder/tree-item`.

## Props

<!-- generated:props:start -->

| Prop                | Type                                   | Required | Default | Description                                                                                                                |
| ------------------- | -------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `aria-label`        | `string`                               | no       | —       | Accessible label for the tree. One of aria-label or aria-labelledby is required.                                           |
| `aria-labelledby`   | `string`                               | no       | —       |                                                                                                                            |
| `checkboxSelection` | `boolean`                              | no       | —       | Render tree-owned checkbox indicators when selectionMode is multiple. Default: false.                                      |
| `class`             | `string`                               | no       | —       | Additional CSS class merged with `.cinder-tree`.                                                                           |
| `disableTypeahead`  | `boolean`                              | no       | —       | Disable typeahead. Default: false.                                                                                         |
| `expandedIds`       | `string`[]                             | no       | —       | Currently expanded branch ids. Bindable.                                                                                   |
| `selectedIds`       | `string`[]                             | no       | —       | Currently selected node ids. Bindable.                                                                                     |
| `selectionBehavior` | `"independent"` \| `"cascade"`         | no       | —       | Select only the target item or cascade through its selectable scope. Default: 'independent'.                               |
| `selectionMode`     | `"none"` \| `"single"` \| `"multiple"` | no       | —       | Selection model. Default: 'none'.                                                                                          |
| `children`          | `(opaque)`                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `selectionControls` | `(opaque)`                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Tree.Item` — a tree node, branch or leaf; see [`tree-item`](../tree-item/README.md).
  Use the related `TreeSelectAll` (still flat-exported as `cinder/tree-select-all`)
  for the root-level select-all control.

<!-- generated:subcomponents:end -->
