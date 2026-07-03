# Sparkbar

Compact labeled meter with a thin horizontal fill bar for inline cost, token, budget, or quota breakdowns.

## Usage

```svelte
<script lang="ts">
  import { Sparkbar } from '@lostgradient/cinder/sparkbar';
</script>

<Sparkbar value={0.31} label="Draft weekly changelog" trailing="$0.31" />
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                     | Required | Default | Description                                                                                                             |
| ----------- | ---------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel` | `string`                                 | no       | —       | Accessible name override. Defaults to `${label}, ${percentage}%`.                                                       |
| `label`     | `string`                                 | yes      | —       | Visible label for the measured row.                                                                                     |
| `max`       | `number`                                 | no       | —       | Upper bound for the range. Defaults to `1` for fractional values.                                                       |
| `size`      | `"sm"` \| `"md"` \| `"lg"`               | no       | —       | Track thickness and text scale. Default `md`.                                                                           |
| `trailing`  | `string`                                 | no       | —       | Optional trailing value such as a cost, token count, or percentage.                                                     |
| `value`     | `number`                                 | yes      | —       | Current bounded value.                                                                                                  |
| `variant`   | `"accent"` \| `"success"` \| `"warning"` | no       | —       | Fill color intent. Default `accent`.                                                                                    |
| `class`     | `(opaque)`                               | no       | —       | Custom class merged with `.cinder-sparkbar`. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
