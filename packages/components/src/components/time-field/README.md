# TimeField

Standalone time-of-day input with optional timezone selection.

## Usage

```svelte
<script lang="ts">
  import TimeField from '@lostgradient/cinder/time-field';

  let time = $state('09:30');
</script>

<TimeField id="reminder-time" label="Reminder time" bind:value={time} />
```

## Props

<!-- generated:props:start -->

| Prop               | Type                     | Required | Default | Description                                                                                                                        |
| ------------------ | ------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `aria-describedby` | `string`                 | no       | —       |                                                                                                                                    |
| `aria-label`       | `string`                 | no       | —       |                                                                                                                                    |
| `aria-labelledby`  | `string`                 | no       | —       |                                                                                                                                    |
| `class`            | `string`                 | no       | —       |                                                                                                                                    |
| `defaultValue`     | `string`                 | no       | —       |                                                                                                                                    |
| `description`      | `string`                 | no       | —       |                                                                                                                                    |
| `disabled`         | `boolean`                | no       | —       |                                                                                                                                    |
| `error`            | `string`                 | no       | —       |                                                                                                                                    |
| `granularity`      | `"minute"` \| `"second"` | no       | —       |                                                                                                                                    |
| `id`               | `string`                 | yes      | —       |                                                                                                                                    |
| `label`            | `string`                 | no       | —       |                                                                                                                                    |
| `name`             | `string`                 | no       | —       |                                                                                                                                    |
| `readonly`         | `boolean`                | no       | —       |                                                                                                                                    |
| `required`         | `boolean`                | no       | —       |                                                                                                                                    |
| `timezone`         | `string`                 | no       | —       |                                                                                                                                    |
| `timezoneName`     | `string`                 | no       | —       |                                                                                                                                    |
| `timezones`        | `string`[]               | no       | —       |                                                                                                                                    |
| `value`            | `string`                 | no       | —       |                                                                                                                                    |
| `onchange`         | `(opaque)`               | no       | —       | Called when the user commits a time or timezone change. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
