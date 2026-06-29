# BentoGrid

BentoGrid renders an asymmetric CSS grid mosaic where individual tiles can span
rows and columns through `BentoGrid.Cell` (or standalone `BentoCell`).

## Usage

```svelte
<script lang="ts">
  import { BentoGrid } from '@lostgradient/cinder/bento-grid';
</script>

<BentoGrid columns={4} gap="var(--cinder-space-4)">
  <BentoGrid.Cell colSpan={2} rowSpan={2}>Featured tile</BentoGrid.Cell>
  <BentoGrid.Cell colSpan={2}>Secondary tile</BentoGrid.Cell>
  <BentoGrid.Cell rowSpan={2}>Tall tile</BentoGrid.Cell>
  <BentoGrid.Cell>Standard tile</BentoGrid.Cell>
</BentoGrid>
```

## Props

<!-- generated:props:start -->

| Prop        | Type                 | Required | Default | Description                                                                                                           |
| ----------- | -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `as`        | `string`             | no       | —       | Rendered HTML tag.                                                                                                    |
| `class`     | `string`             | no       | —       | Custom class merged with `.cinder-bento-grid`.                                                                        |
| `collapse`  | `boolean`            | no       | `true`  | Enables a narrow-screen fallback where BentoGrid becomes a single column and BentoCell placement resets to auto flow. |
| `columnGap` | `string`             | no       | —       | Column gap override. Wins over `gap` for columns.                                                                     |
| `columns`   | `string` \| `number` | no       | —       | Positive integer number of equal-width columns or a full CSS `grid-template-columns` value.                           |
| `gap`       | `string`             | no       | —       | Uniform row and column gap.                                                                                           |
| `rowGap`    | `string`             | no       | —       | Row gap override. Wins over `gap` for rows.                                                                           |
| `children`  | `(opaque)`           | yes      | —       | Bento grid contents. Not expressible in JSON Schema; see the component types for the signature.                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `BentoGrid.Cell` - optional placement child for bento layouts; see
[`bento-cell`](../bento-cell/README.md).
<!-- generated:subcomponents:end -->
