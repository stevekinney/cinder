# StatisticGroup

Grid container that lays out multiple stat tiles with consistent spacing and alignment.

## Usage

`StatisticGroup` is a compound component. Import the parent and compose
`StatisticGroup.Statistic` via the namespace API.

```svelte
<script lang="ts">
  import { StatisticGroup } from '@lostgradient/cinder/statistic-group';
</script>

<StatisticGroup label="This quarter" columns={3}>
  <StatisticGroup.Statistic label="Monthly revenue" value="$48,250" />
  <StatisticGroup.Statistic label="Active users" value={1289} />
  <StatisticGroup.Statistic label="Churn" value="2.1%" />
</StatisticGroup>
```

The leaf remains importable individually for à-la-carte builds — see
`@lostgradient/cinder/statistic`.

## Props

<!-- generated:props:start -->

| Prop       | Type                                           | Required | Default       | Description                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                       | no       | —             | Additional class names merged with `.cinder-statistic-group`.                                                                                                                                                                                                          |
| `columns`  | `1` \| `2` \| `3` \| `4` \| `"auto"`           | no       | `"'auto'"`    | Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.                                                                                                                                                                                           |
| `label`    | `string`                                       | no       | —             | Optional accessible label for the whole stat set. When provided, the container becomes `role="group"` and uses this value as its accessible name.                                                                                                                      |
| `style`    | `string`                                       | no       | —             | Inline style string applied to the `.cinder-statistic-group` root.                                                                                                                                                                                                     |
| `variant`  | `"default"` \| `"cards"` \| `"shared-borders"` | no       | `"'default'"` | Visual variant; surfaced as `data-cinder-variant` for CSS styling. - `'default'` — plain grid, no borders or backgrounds. - `'cards'` — each stat gets a card-style border and shadow. - `'shared-borders'` — single outer border with 1px gap dividers between stats. |
| `children` | `(opaque)`                                     | yes      | —             | Statistic children, typically one or more `<Statistic>` components. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-statistic-group-card-padding`
- `--cinder-statistic-group-gap`
- `--cinder-statistic-group-shared-cell-padding`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `StatisticGroup.Statistic` — a single metric with optional change indicator; see
  [`stat`](../statistic/README.md).

<!-- generated:subcomponents:end -->
