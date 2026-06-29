# BentoCell

BentoCell controls row and column placement for one tile inside a `BentoGrid`.

## Usage

```svelte
<script lang="ts">
  import { BentoCell } from '@lostgradient/cinder/bento-cell';
</script>

<BentoCell colSpan={2} rowSpan={2}>Featured tile</BentoCell>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                 | Required | Default | Description                                                                                     |
| ------------- | -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------- |
| `as`          | `string`             | no       | —       | Rendered HTML tag.                                                                              |
| `class`       | `string`             | no       | —       | Custom class merged with `.cinder-bento-cell`.                                                  |
| `colSpan`     | `string` \| `number` | no       | —       | Number of columns this cell spans.                                                              |
| `columnEnd`   | `string` \| `number` | no       | —       | Explicit `grid-column-end` value.                                                               |
| `columnStart` | `string` \| `number` | no       | —       | Explicit `grid-column-start` value.                                                             |
| `rowEnd`      | `string` \| `number` | no       | —       | Explicit `grid-row-end` value.                                                                  |
| `rowSpan`     | `string` \| `number` | no       | —       | Number of rows this cell spans.                                                                 |
| `rowStart`    | `string` \| `number` | no       | —       | Explicit `grid-row-start` value.                                                                |
| `children`    | `(opaque)`           | yes      | —       | Bento cell contents. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
