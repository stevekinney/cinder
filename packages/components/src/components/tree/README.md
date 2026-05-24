# Tree

A Tree component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Tree from 'cinder/tree';
</script>

<Tree />
```

## Props

<!-- generated:props:start -->

| Prop                | Type                                   | Required | Default | Description                                                                                  |
| ------------------- | -------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------- |
| `aria-label`        | `string`                               | no       | —       | Accessible label for the tree. One of aria-label or aria-labelledby is required.             |
| `aria-labelledby`   | `string`                               | no       | —       |                                                                                              |
| `checkboxSelection` | `boolean`                              | no       | —       | Render tree-owned checkbox indicators when selectionMode is multiple. Default: false.        |
| `class`             | `string`                               | no       | —       | Additional CSS class merged with `.cinder-tree`.                                             |
| `disableTypeahead`  | `boolean`                              | no       | —       | Disable typeahead. Default: false.                                                           |
| `expandedIds`       | `string`[]                             | no       | —       | Currently expanded branch ids. Bindable.                                                     |
| `selectedIds`       | `string`[]                             | no       | —       | Currently selected node ids. Bindable.                                                       |
| `selectionBehavior` | `"independent"` \| `"cascade"`         | no       | —       | Select only the target item or cascade through its selectable scope. Default: 'independent'. |
| `selectionMode`     | `"none"` \| `"single"` \| `"multiple"` | no       | —       | Selection model. Default: 'none'.                                                            |
| `children`          | `(opaque)`                             | —        | —       | function-or-snippet                                                                          |
| `selectionControls` | `(opaque)`                             | —        | —       | function-or-snippet                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
