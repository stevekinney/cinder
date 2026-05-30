# GridList

A GridList component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`GridList` is a compound component. Import the parent and compose
`GridList.Item` via the namespace API.

```svelte
<script lang="ts">
  import { GridList } from 'cinder/grid-list';
</script>

<GridList columns="14rem" aria-label="Projects">
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
`cinder/grid-list-item`.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                                                                                                                     |
| ---------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`  | `string`   | no       | —       | Minimum width of each grid cell, expressed as a CSS `<length>` value (e.g. `"16rem"`, `"240px"`, `"min(20rem, 100%)"`). Used as the first argument to `minmax()` inside a `repeat(auto-fill, ...)` track. Default: `"16rem"`. Empty string is treated as unset. |
| `children` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                      |
| `class`    | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                         |

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
