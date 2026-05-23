# TimePicker

A TimePicker component for entering a time with an optional scroll-list popover.

## Usage

```svelte
<script lang="ts">
  import TimePicker from 'cinder/time-picker';

  let value = $state('09:30');
</script>

<TimePicker id="appointment-time" bind:value label="Appointment time" />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                     | Required | Default | Description         |
| -------------- | ---------------------------------------- | -------- | ------- | ------------------- |
| `defaultValue` | `string`                                 | no       | —       |                     |
| `description`  | `string`                                 | no       | —       |                     |
| `disabled`     | `boolean`                                | no       | —       |                     |
| `error`        | `string`                                 | no       | —       |                     |
| `hourCycle`    | `"h11"` \| `"h12"` \| `"h23"` \| `"h24"` | no       | —       |                     |
| `id`           | `string`                                 | yes      | —       |                     |
| `label`        | `string`                                 | no       | —       |                     |
| `locale`       | `string`                                 | no       | —       |                     |
| `max`          | `string`                                 | no       | —       |                     |
| `min`          | `string`                                 | no       | —       |                     |
| `name`         | `string`                                 | no       | —       |                     |
| `required`     | `boolean`                                | no       | —       |                     |
| `seconds`      | `boolean`                                | no       | —       |                     |
| `step`         | `number`                                 | no       | —       |                     |
| `value`        | `string`                                 | no       | —       |                     |
| `class`        | `(opaque)`                               | —        | —       | unknown-shape       |
| `onchange`     | `(opaque)`                               | —        | —       | function-or-snippet |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
