# Grid

Grid renders a low-chrome CSS grid container for explicit columns, intrinsic
auto-fill layouts, and optional child placement through `Grid.Item`.

## Usage

```svelte
<script lang="ts">
  import { Grid } from '@lostgradient/cinder/grid';
</script>

<Grid columns={3} gap="var(--cinder-space-4)">
  <Grid.Item span={2}>Wide item</Grid.Item>
  <div>Regular item</div>
</Grid>
```

Use `minItemWidth` for intrinsic responsive grids without adding media queries:

```svelte
<Grid minItemWidth="16rem" gap="var(--cinder-space-6)">
  <article>One</article>
  <article>Two</article>
  <article>Three</article>
</Grid>
```

## Props

<!-- generated:props:start -->

| Prop           | Type                  | Required | Default | Description                                                                                                                                    |
| -------------- | --------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `as`           | `string`              | no       | —       | Rendered HTML tag.                                                                                                                             |
| `class`        | `string`              | no       | —       | Custom class merged with `.cinder-grid`.                                                                                                       |
| `columnGap`    | `string`              | no       | —       | Column gap override. Wins over `gap` for columns.                                                                                              |
| `columns`      | `string` \| `integer` | no       | —       | Positive integer number of equal-width columns or a full CSS `grid-template-columns` value. Numeric values render as `repeat(<columns>, 1fr)`. |
| `gap`          | `string`              | no       | —       | Uniform row and column gap.                                                                                                                    |
| `minItemWidth` | `string`              | no       | —       | Minimum item width for an intrinsic auto-fill grid. When present, this takes precedence over `columns`.                                        |
| `rowGap`       | `string`              | no       | —       | Row gap override. Wins over `gap` for rows.                                                                                                    |
| `children`     | `(opaque)`            | yes      | —       | Grid contents. Not expressible in JSON Schema; see the component types for the signature.                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Grid.Item` - optional placement child for spanning or pinning a grid item;
  see [`grid-item`](../grid-item/README.md).

<!-- generated:subcomponents:end -->
