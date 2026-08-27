# Sparkbar

Compact labeled meter with a thin horizontal fill bar for inline cost, token, budget, or quota breakdowns.

## Usage

```svelte
<script lang="ts">
  import { Sparkbar } from '@lostgradient/cinder/sparkbar';
</script>

<Sparkbar value={0.31} label="Draft weekly changelog" trailing="$0.31" />
```

## Theming

Sparkbar inherits its foreground from `currentColor` and keeps its background transparent. The default `accent` fill uses the first resolved `--cinder-chart-series-*` color, and a partial `theme` can override that palette. The `success` and `warning` variants keep their semantic status tokens; the meter's filled position communicates magnitude independently of color.

## Props

<!-- generated:props:start -->

| Prop            | Type                                                                                                      | Required | Default | Description                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `ariaLabel`     | `string`                                                                                                  | no       | —       | Accessible name override. Defaults to `${label}, ${percentage}%`.                     |
| `ariaValueText` | `string`                                                                                                  | no       | —       | Accessible value text override. Defaults to the trimmed trailing value when provided. |
| `class`         | `string`                                                                                                  | no       | —       | Custom class merged with `.cinder-sparkbar`.                                          |
| `label`         | `string`                                                                                                  | yes      | —       | Visible label for the measured row.                                                   |
| `max`           | `number`                                                                                                  | no       | —       | Upper bound for the range. Defaults to `1` for fractional values.                     |
| `size`          | `"sm"` \| `"md"` \| `"lg"`                                                                                | no       | —       | Track thickness and text scale. Default `md`.                                         |
| `theme`         | { background?: `string`; foreground?: `string`; grid?: `string`; muted?: `string`; palette?: `string`[] } | no       | —       | Partial visual theme override. Omitted fields inherit the surrounding application.    |
| `trailing`      | `string`                                                                                                  | no       | —       | Optional trailing value such as a cost, token count, or percentage.                   |
| `value`         | `number`                                                                                                  | yes      | —       | Current bounded value.                                                                |
| `variant`       | `"accent"` \| `"success"` \| `"warning"`                                                                  | no       | —       | Fill color intent. Default `accent`.                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
