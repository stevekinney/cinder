# KanbanBoard

Controlled multi-column board for reordering cards within and across workflow columns with keyboard, pointer, and live-region feedback.

## Usage

```svelte
<script lang="ts">
  import { KanbanBoard } from '@lostgradient/cinder/kanban-board';
</script>
```

## Guidance

### Use When

- Presenting a workflow board where users move cards between ordered columns.
- Consumers own card rendering and need cinder to manage reorder affordances and change metadata.

### Avoid When

- Showing a single ordered list — use sortable-list instead.
- Sorting by computed fields rather than direct manual placement.

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                                |
| ---------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`   | no       | —       | Additional class merged onto the `.cinder-kanban-board` root element.                                                      |
| `collapsible`    | `boolean`  | no       | —       | When true, each column renders a collapse/expand button that toggles its card list.                                        |
| `label`          | `string`   | no       | —       | Accessible label applied to the board's `<section>` root via `aria-label`.                                                 |
| `reorderColumns` | `boolean`  | no       | —       | When true (default), columns can be reordered by dragging or keyboard. Set to false to make column order fixed.            |
| `card`           | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `columnActions`  | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `columnHeader`   | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `columns`        | `(opaque)` | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `emptyColumn`    | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `getCardKey`     | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `getCardLabel`   | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onchange`       | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-kanban-card-background`
- `--cinder-kanban-column-background`
- `--cinder-kanban-column-gap`
- `--cinder-kanban-column-width`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
