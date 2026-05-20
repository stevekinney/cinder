# GridList

A GridList component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import GridList from 'cinder/grid-list';
</script>

<GridList />
```

## Props

<!-- generated:props:start -->

| Prop      | Type       | Required | Default | Description                                                                                                                                                                                                                                                     |
| --------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns` | `string`   | no       | —       | Minimum width of each grid cell, expressed as a CSS `<length>` value (e.g. `"16rem"`, `"240px"`, `"min(20rem, 100%)"`). Used as the first argument to `minmax()` inside a `repeat(auto-fill, ...)` track. Default: `"16rem"`. Empty string is treated as unset. |
| `class`   | `(opaque)` | —        | —       | unknown-shape                                                                                                                                                                                                                                                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-grid-list-min-width`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
