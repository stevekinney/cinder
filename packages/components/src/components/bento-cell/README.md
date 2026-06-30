# BentoCell

BentoCell controls row and column placement for one tile inside a `BentoGrid`.

## Usage

```svelte
<script lang="ts">
  import { BentoGrid } from '@lostgradient/cinder/bento-grid';
</script>

<BentoGrid columns={4} gap="var(--cinder-space-4)">
  <BentoGrid.Cell colSpan={2} rowSpan={2}>Featured tile</BentoGrid.Cell>
  <BentoGrid.Cell>Standard tile</BentoGrid.Cell>
</BentoGrid>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                  | Required | Default | Description                                                                                     |
| ------------- | --------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------- |
| `as`          | `string`              | no       | —       | Rendered HTML tag.                                                                              |
| `class`       | `string`              | no       | —       | Custom class merged with `.cinder-bento-cell`.                                                  |
| `colSpan`     | `string` \| `integer` | no       | —       | Number of columns this cell spans.                                                              |
| `columnEnd`   | `string` \| `integer` | no       | —       | Explicit `grid-column-end` value.                                                               |
| `columnStart` | `string` \| `integer` | no       | —       | Explicit `grid-column-start` value.                                                             |
| `rowEnd`      | `string` \| `integer` | no       | —       | Explicit `grid-row-end` value.                                                                  |
| `rowSpan`     | `string` \| `integer` | no       | —       | Number of rows this cell spans.                                                                 |
| `rowStart`    | `string` \| `integer` | no       | —       | Explicit `grid-row-start` value.                                                                |
| `children`    | `(opaque)`            | yes      | —       | Bento cell contents. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
