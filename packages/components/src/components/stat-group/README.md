# StatGroup

A StatGroup component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import StatGroup from 'cinder/stat-group';
</script>

<StatGroup />
```

## Props

<!-- generated:props:start -->

| Prop      | Type                                           | Required | Default       | Description                                                                                                                                                                                                                                                            |
| --------- | ---------------------------------------------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`   | `string`                                       | no       | —             | Additional class names merged with `.cinder-stat-group`.                                                                                                                                                                                                               |
| `columns` | `1` \| `2` \| `3` \| `4` \| `"auto"`           | no       | `"'auto'"`    | Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.                                                                                                                                                                                           |
| `label`   | `string`                                       | no       | —             | Optional accessible label for the whole stat set. When provided, the container becomes `role="group"` and uses this value as its accessible name.                                                                                                                      |
| `variant` | `"default"` \| `"cards"` \| `"shared-borders"` | no       | `"'default'"` | Visual variant; surfaced as `data-cinder-variant` for CSS styling. - `'default'` — plain grid, no borders or backgrounds. - `'cards'` — each stat gets a card-style border and shadow. - `'shared-borders'` — single outer border with 1px gap dividers between stats. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
