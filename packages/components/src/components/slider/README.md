# Slider

Drag handle input for selecting a numeric value within a bounded range.

## Usage

```svelte
<script lang="ts">
  import Slider from '@lostgradient/cinder/slider';
</script>

<Slider />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                            | Required | Default | Description                                                                                                                |
| -------------- | ------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                        | no       | —       | Extra class names merged with `.cinder-slider`.                                                                            |
| `disabled`     | `boolean`                       | no       | —       | Disables interaction.                                                                                                      |
| `label`        | `string`                        | yes      | —       | Visible label / accessible name for the slider. Required.                                                                  |
| `max`          | `number`                        | no       | —       | Maximum value. Default `100`.                                                                                              |
| `min`          | `number`                        | no       | —       | Minimum value. Default `0`.                                                                                                |
| `mode`         | `"single"` \| `"range"`         | no       | —       |                                                                                                                            |
| `name`         | `string`                        | no       | —       | Form field name. Renders hidden inputs for form submission.                                                                |
| `pageStep`     | `number`                        | no       | —       | Step increment for Page Up/Down. Default `step * 10`.                                                                      |
| `step`         | `number`                        | no       | —       | Step increment for arrow keys. Default `1`. Must be a positive finite number.                                              |
| `ticks`        | `false` \| `true` \| `number`[] | no       | —       | Optional tick marks. `true` renders one per `step`; an array snaps to those values.                                        |
| `defaultValue` | `(opaque)`                      | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `onchange`     | `(opaque)`                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `value`        | `(opaque)`                      | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `valueText`    | `(opaque)`                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
