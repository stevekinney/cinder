# Meter

Bounded measurement gauge for fluctuating values like battery, quota, CPU, and memory usage.

Use `Meter` for static measurements with known bounds (`role="meter"`). Use `Progress` for task completion over time (`role="progressbar"`).

## Usage

```svelte
<script lang="ts">
  import Meter from '@lostgradient/cinder/meter';
</script>

<Meter value={52} ariaLabel="Battery level" />
```

## Props

<!-- generated:props:start -->

| Prop             | Type                       | Required | Default | Description                                                                                                        |
| ---------------- | -------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `ariaLabel`      | `string`                   | no       | —       | Accessible name applied directly to the meter element when no visible label element is present.                    |
| `ariaLabelledby` | `string`                   | no       | —       | Id of a visible element that serves as the accessible name for the meter. Prefer this when a visible label exists. |
| `ariaValueText`  | `string`                   | no       | —       | Human-readable text exposed via `aria-valuetext`. Example: `50% (6 hours remaining)`.                              |
| `class`          | `string`                   | no       | —       | Additional class names merged with `.cinder-meter`.                                                                |
| `high`           | `number`                   | no       | —       | Upper threshold boundary for segmented rendering.                                                                  |
| `low`            | `number`                   | no       | —       | Lower threshold boundary for segmented rendering.                                                                  |
| `max`            | `number`                   | no       | —       | Upper bound for the range. Defaults to 100.                                                                        |
| `min`            | `number`                   | no       | —       | Lower bound for the range. Defaults to 0.                                                                          |
| `optimum`        | `number`                   | no       | —       | Optimal target value. Influences computed state semantics to match native meter expectations.                      |
| `size`           | `"sm"` \| `"md"` \| `"lg"` | no       | —       | Size token for track height. Default `md`.                                                                         |
| `value`          | `number`                   | no       | —       | Current measurement value. Defaults to 0.                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
