# Slider

A Slider component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Slider from 'cinder/slider';
</script>

<Slider />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                            | Required | Default | Description                                                                         |
| -------------- | ------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------- |
| `class`        | `string`                        | no       | —       | Extra class names merged with `.cinder-slider`.                                     |
| `disabled`     | `boolean`                       | no       | —       | Disables interaction.                                                               |
| `label`        | `string`                        | yes      | —       | Visible label / accessible name for the slider. Required.                           |
| `max`          | `number`                        | no       | —       | Maximum value. Default `100`.                                                       |
| `min`          | `number`                        | no       | —       | Minimum value. Default `0`.                                                         |
| `mode`         | `"single"` \| `"range"`         | no       | —       |                                                                                     |
| `name`         | `string`                        | no       | —       | Form field name. Renders hidden inputs for form submission.                         |
| `pageStep`     | `number`                        | no       | —       | Step increment for Page Up/Down. Default `step * 10`.                               |
| `step`         | `number`                        | no       | —       | Step increment for arrow keys. Default `1`. Must be a positive finite number.       |
| `ticks`        | `false` \| `true` \| `number`[] | no       | —       | Optional tick marks. `true` renders one per `step`; an array snaps to those values. |
| `defaultValue` | `(opaque)`                      | —        | —       | unknown-shape                                                                       |
| `onchange`     | `(opaque)`                      | —        | —       | function-or-snippet                                                                 |
| `value`        | `(opaque)`                      | —        | —       | unknown-shape                                                                       |
| `valueText`    | `(opaque)`                      | —        | —       | function-or-snippet                                                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
