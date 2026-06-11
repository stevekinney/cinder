# SortableList

Drag-and-drop reorderable list that emits the new order on each change.

## Usage

```svelte
<script lang="ts">
  import SortableList from '@lostgradient/cinder/sortable-list';
</script>

<SortableList />
```

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`             | `string`   | no       | —       |                                                                                                                                                                                                                                                                                                                                                              |
| `label`             | `string`   | no       | —       | Accessible name for the list (applied as aria-label on the list root).                                                                                                                                                                                                                                                                                       |
| `announcements`     | `(opaque)` | no       | —       | Optional overrides for announcement strings. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                         |
| `children`          | `(opaque)` | yes      | —       | Row content snippet. Receives the item and a per-row context. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                     |
| `formatHandleLabel` | `(opaque)` | no       | —       | Optional formatter for the drag handle's accessible name. Default: "Reorder {itemLabel}". A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                         |
| `getItemLabel`      | `(opaque)` | yes      | —       | Returns an accessible label for each item (e.g., "Buy milk"). The second argument is the item's original index in the `items` array (not its current visual position during a drag). Used in handle aria-label and announcements. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `getKey`            | `(opaque)` | yes      | —       | Returns a stable key for each item. Must not change across reorders. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                              |
| `handle`            | `(opaque)` | no       | —       | Optional snippet rendered inside the drag-handle button. Receives { pressed, label }. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                             |
| `items`             | `(opaque)` | yes      | —       | The list of items to render. A generically typed prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                        |
| `onreorder`         | `(opaque)` | yes      | —       | Fires with the full reordered array and change metadata on drop. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
