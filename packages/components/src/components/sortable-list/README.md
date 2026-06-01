# SortableList

Drag-and-drop reorderable list that emits the new order on each change.

## Usage

```svelte
<script lang="ts">
  import SortableList from 'cinder/sortable-list';
</script>

<SortableList />
```

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                |
| ------------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`             | `string`   | no       | —       |                                                                                                                            |
| `label`             | `string`   | no       | —       | Accessible name for the list (applied as aria-label on the list root).                                                     |
| `announcements`     | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `children`          | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `formatHandleLabel` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `getItemLabel`      | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `getKey`            | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `handle`            | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `items`             | `(opaque)` | no       | —       | A generically typed prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.   |
| `onreorder`         | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
