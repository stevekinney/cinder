# GridItem

GridItem is the optional `Grid.Item` placement leaf. Use it when a grid child
needs to span tracks or start at a specific track.

## Usage

```svelte
<script lang="ts">
  import { Grid } from '@lostgradient/cinder/grid';
</script>

<Grid columns={12}>
  <Grid.Item span={6}>Half width</Grid.Item>
  <Grid.Item span={6}>Half width</Grid.Item>
</Grid>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                 | Required | Default | Description                                                                                    |
| ------------- | -------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------- |
| `as`          | `string`             | no       | —       | Rendered HTML tag.                                                                             |
| `class`       | `string`             | no       | —       | Custom class merged with `.cinder-grid-item`.                                                  |
| `columnEnd`   | `string` \| `number` | no       | —       | Explicit `grid-column-end` value.                                                              |
| `columnStart` | `string` \| `number` | no       | —       | Explicit `grid-column-start` value.                                                            |
| `rowSpan`     | `string` \| `number` | no       | —       | Number of rows this item spans.                                                                |
| `rowStart`    | `string` \| `number` | no       | —       | Explicit `grid-row-start` value.                                                               |
| `span`        | `string` \| `number` | no       | —       | Number of columns this item spans.                                                             |
| `children`    | `(opaque)`           | yes      | —       | Grid item contents. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
