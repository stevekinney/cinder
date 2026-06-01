# StatGroup

Grid container that lays out multiple stat tiles with consistent spacing and alignment.

## Usage

`StatGroup` is a compound component. Import the parent and compose
`StatGroup.Stat` via the namespace API.

```svelte
<script lang="ts">
  import { StatGroup } from 'cinder/stat-group';
</script>

<StatGroup label="This quarter" columns={3}>
  <StatGroup.Stat label="Monthly revenue" value="$48,250" />
  <StatGroup.Stat label="Active users" value={1289} />
  <StatGroup.Stat label="Churn" value="2.1%" />
</StatGroup>
```

The leaf remains importable individually for à-la-carte builds — see
`cinder/stat`.

## Props

<!-- generated:props:start -->

| Prop       | Type                                           | Required | Default       | Description                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                       | no       | —             | Additional class names merged with `.cinder-stat-group`.                                                                                                                                                                                                               |
| `columns`  | `1` \| `2` \| `3` \| `4` \| `"auto"`           | no       | `"'auto'"`    | Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.                                                                                                                                                                                           |
| `label`    | `string`                                       | no       | —             | Optional accessible label for the whole stat set. When provided, the container becomes `role="group"` and uses this value as its accessible name.                                                                                                                      |
| `variant`  | `"default"` \| `"cards"` \| `"shared-borders"` | no       | `"'default'"` | Visual variant; surfaced as `data-cinder-variant` for CSS styling. - `'default'` — plain grid, no borders or backgrounds. - `'cards'` — each stat gets a card-style border and shadow. - `'shared-borders'` — single outer border with 1px gap dividers between stats. |
| `children` | `(opaque)`                                     | no       | —             | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `StatGroup.Stat` — a single metric with optional change indicator; see
  [`stat`](../stat/README.md).

<!-- generated:subcomponents:end -->
