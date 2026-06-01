# TimePicker

A TimePicker component for entering a time with an optional scroll-list popover.

## Why TimePicker instead of `<input type="time">`?

A plain `<input type="time">` works, but its native picker surface differs significantly across browsers and operating systems — Chrome on Android shows a clock face, Safari on macOS shows a draggable column, Firefox shows a dropdown. TimePicker gives you:

- **Consistent styling** — the input and toggle share the Cinder design token system on every platform.
- **Consistent picker surface** — the scroll-list popover behaves identically across browsers, with the same keyboard navigation, hour-cycle display, and optional seconds column.
- **Locale-aware hour cycles** — the `locale` and `hourCycle` props resolve the correct h11/h12/h23/h24 cycle for any locale, whereas the native picker always uses the OS locale.

TimePicker intentionally hides the browser's native picker indicator (the `::-webkit-calendar-picker-indicator` pseudo-element, present in Chromium and WebKit) so only the Cinder toggle button is visible. The `<input type="time">` element stays in place as the value source: it still accepts direct keyboard entry, enforces `min`/`max`/`step`, participates in form submission, and surfaces native validation. Only the redundant visual affordance for the native picker surface is suppressed.

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

| Prop           | Type                                     | Required | Default | Description                                                                                                                |
| -------------- | ---------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `defaultValue` | `string`                                 | no       | —       |                                                                                                                            |
| `description`  | `string`                                 | no       | —       |                                                                                                                            |
| `disabled`     | `boolean`                                | no       | —       |                                                                                                                            |
| `error`        | `string`                                 | no       | —       |                                                                                                                            |
| `hourCycle`    | `"h11"` \| `"h12"` \| `"h23"` \| `"h24"` | no       | —       |                                                                                                                            |
| `id`           | `string`                                 | yes      | —       |                                                                                                                            |
| `label`        | `string`                                 | no       | —       |                                                                                                                            |
| `locale`       | `string`                                 | no       | —       |                                                                                                                            |
| `max`          | `string`                                 | no       | —       |                                                                                                                            |
| `min`          | `string`                                 | no       | —       |                                                                                                                            |
| `name`         | `string`                                 | no       | —       |                                                                                                                            |
| `required`     | `boolean`                                | no       | —       |                                                                                                                            |
| `seconds`      | `boolean`                                | no       | —       |                                                                                                                            |
| `step`         | `number`                                 | no       | —       |                                                                                                                            |
| `value`        | `string`                                 | no       | —       |                                                                                                                            |
| `class`        | `(opaque)`                               | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `onchange`     | `(opaque)`                               | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
