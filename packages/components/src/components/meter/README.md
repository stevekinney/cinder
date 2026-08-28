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

For a measurement that has no numeric reading, provide a verdict. The verdict
label is rendered next to the track and is also announced as `aria-valuetext`.

```svelte
<Meter verdict={{ level: 'unknown', label: 'Awaiting data' }} ariaLabel="Service health" />
```

## Props

<!-- generated:props:start -->

| Prop             | Type                       | Required | Default | Description                                                                                                                             |
| ---------------- | -------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel`      | `string`                   | no       | —       | Accessible name applied directly to the meter element when no visible label element is present.                                         |
| `ariaLabelledby` | `string`                   | no       | —       | Id of a visible element that serves as the accessible name for the meter. Prefer this when a visible label exists.                      |
| `ariaValueText`  | `string`                   | no       | —       | Human-readable text exposed via `aria-valuetext`. When omitted, `aria-valuetext` is not rendered. Example: `50% (6 hours remaining)`.   |
| `class`          | `string`                   | no       | —       | Additional class names merged with `.cinder-meter`.                                                                                     |
| `high`           | `number`                   | no       | —       | Upper threshold boundary for segmented rendering.                                                                                       |
| `low`            | `number`                   | no       | —       | Lower threshold boundary for segmented rendering.                                                                                       |
| `max`            | `number`                   | no       | —       | Upper bound for the range. Defaults to 100.                                                                                             |
| `min`            | `number`                   | no       | —       | Lower bound for the range. Defaults to 0.                                                                                               |
| `optimum`        | `number`                   | no       | —       | Optimal target value. Influences computed state semantics to match native meter expectations.                                           |
| `size`           | `"sm"` \| `"md"` \| `"lg"` | no       | —       | Size token for track height. Default `md`.                                                                                              |
| `value`          | `number`                   | no       | —       | Current measurement value. Defaults to 0.                                                                                               |
| `verdict`        | `(opaque)`                 | no       | —       | Semantic verdict for measurements without a numeric reading. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
