# GridList

GridList lays out homogeneous card-like list items in responsive auto-fit columns.

## Usage

`GridList` is a compound component. Import the parent and compose
`GridList.Item` via the namespace API.

```svelte
<script lang="ts">
  import { GridList } from '@lostgradient/cinder/grid-list';
</script>

<GridList minColumnWidth="14rem" aria-label="Projects">
  <GridList.Item>
    {#snippet title()}<strong>Phoenix</strong>{/snippet}
    {#snippet subtitle()}<span>Reactive runtime experiments.</span>{/snippet}
  </GridList.Item>
  <GridList.Item href="/projects/atlas">
    {#snippet title()}Atlas{/snippet}
  </GridList.Item>
</GridList>
```

The leaf remains importable individually for à-la-carte builds — see
`@lostgradient/cinder/grid-list-item`.

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                                                                                                                                       |
| ---------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minColumnWidth` | `string`   | no       | —       | Minimum width of each grid cell, expressed as a CSS `<length>` value (e.g. `"16rem"`, `"240px"`, `"min(20rem, 100%)"`). Forwarded to Grid's `minItemWidth` sizing contract. Default: `"16rem"`. Empty string is treated as unset. |
| `children`       | `(opaque)` | yes      | —       | Items — typically `GridListItem` instances. Not expressible in JSON Schema; see the component types for the signature.                                                                                                            |
| `class`          | `(opaque)` | no       | —       | Extra class names merged with `cinder-grid-list`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-grid-list-min-width`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `GridList.Item` — a card-style grid cell with optional stretched-link
  behavior; see [`grid-list-item`](../grid-list-item/README.md).

<!-- generated:subcomponents:end -->
