# DatePicker

Controlled date/date-time picker that combines a text trigger, floating calendar, and optional time controls.

## Usage

```svelte
<script lang="ts">
  import { DatePicker } from '@lostgradient/cinder/date-picker';

  let value = $state<string | undefined>('2026-06-29');
</script>

<DatePicker id="event-date" bind:value label="Event date" />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                                            | Required | Default | Description                                                                                               |
| ------------- | ----------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                                        | no       | —       | Additional classes for the root.                                                                          |
| `description` | `string`                                        | no       | —       | Optional helper text.                                                                                     |
| `disabled`    | `boolean`                                       | no       | —       | Disable interaction.                                                                                      |
| `error`       | `string`                                        | no       | —       | Optional validation error text.                                                                           |
| `granularity` | `"day"` \| `"hour"` \| `"minute"` \| `"second"` | no       | —       | Date-time precision. Defaults to day.                                                                     |
| `id`          | `string`                                        | yes      | —       | Stable id for label/input/error wiring.                                                                   |
| `label`       | `string`                                        | no       | —       | Field label text.                                                                                         |
| `max`         | `string`                                        | no       | —       | Maximum allowed value (same format as `value`).                                                           |
| `min`         | `string`                                        | no       | —       | Minimum allowed value (same format as `value`).                                                           |
| `placeholder` | `string`                                        | no       | —       | Placeholder shown when empty.                                                                             |
| `value`       | `string`                                        | no       | —       | Controlled value as local ISO string. Bindable.                                                           |
| `onchange`    | `(opaque)`                                      | no       | —       | Called when the value changes. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
