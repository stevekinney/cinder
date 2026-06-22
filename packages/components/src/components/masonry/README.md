# Masonry

Masonry renders a pure CSS waterfall layout with balanced variable-height
columns. It uses CSS columns, so DOM and screen-reader order remain
top-to-bottom through each column rather than left-to-right across visual rows.

## Usage

```svelte
<script lang="ts">
  import { Masonry } from '@lostgradient/cinder/masonry';
</script>

<Masonry columns="3" gap="var(--cinder-space-4)">
  <article>Short card</article>
  <article>Much taller card content</article>
  <article>Medium card</article>
</Masonry>
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                                                                                                      | Required | Default | Description                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `as`       | `"article"` \| `"aside"` \| `"div"` \| `"footer"` \| `"header"` \| `"main"` \| `"nav"` \| `"section"` \| `"ul"` \| `"ol"` | no       | `"div"` | Rendered HTML tag. Constrained to layout-safe container elements; void elements such as `img`, `input`, `br`, and `hr` are excluded. |
| `class`    | `string`                                                                                                                  | no       | —       | Custom class merged with `.cinder-masonry`.                                                                                          |
| `columns`  | `string`                                                                                                                  | no       | —       | CSS column count value.                                                                                                              |
| `gap`      | `string`                                                                                                                  | no       | —       | Gap between columns and between direct children.                                                                                     |
| `children` | `(opaque)`                                                                                                                | yes      | —       | Masonry contents. Not expressible in JSON Schema; see the component types for the signature.                                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
