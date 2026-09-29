# PermissionMatrix

A discrete matrix for scanning scope, role, or policy access across operations.

Use PermissionMatrix when each cell is an enumerated access state. Use MatrixChart when cell values are numeric magnitudes that need heatmap color interpolation.

## Usage

```svelte
<script lang="ts">
  import { PermissionMatrix } from '@lostgradient/cinder';

  const rows = [{ id: 'workflows-admin', label: 'workflows:admin' }];
  const columns = [{ id: 'cancel', label: 'cancel' }];
</script>

<PermissionMatrix
  label="Scope matrix"
  {rows}
  {columns}
  getCellState={() => 'granted'}
  onCellClick={(row, column) => console.log(row.id, column.id)}
/>
```

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                                                 |
| ---------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`   | no       | —       | Custom class applied to the root element.                                                                                                   |
| `description`    | `string`   | no       | —       | Optional description rendered above the matrix.                                                                                             |
| `label`          | `string`   | yes      | —       | Accessible label for the matrix.                                                                                                            |
| `loading`        | `boolean`  | no       | —       | Whether the matrix is in a loading state. Default `false`.                                                                                  |
| `rowHeaderLabel` | `string`   | no       | —       | Header label for the row axis. Default `Scope`.                                                                                             |
| `columns`        | `(opaque)` | yes      | —       | Column definitions, usually operations. Not expressible in JSON Schema; see the component types for the signature.                          |
| `empty`          | `(opaque)` | no       | —       | Snippet rendered when rows or columns are empty. Not expressible in JSON Schema; see the component types for the signature.                 |
| `getCellState`   | `(opaque)` | yes      | —       | Resolves the discrete state for one row and column intersection. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent` | `(opaque)` | no       | —       | Snippet rendered while the matrix is loading. Not expressible in JSON Schema; see the component types for the signature.                    |
| `onCellClick`    | `(opaque)` | no       | —       | Called when a matrix cell is activated. Not expressible in JSON Schema; see the component types for the signature.                          |
| `rows`           | `(opaque)` | yes      | —       | Row definitions, usually authorization scopes. Not expressible in JSON Schema; see the component types for the signature.                   |
| `stateLabels`    | `(opaque)` | no       | —       | Accessible and visible labels for the built-in states. Not expressible in JSON Schema; see the component types for the signature.           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
