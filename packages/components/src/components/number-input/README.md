# NumberInput

Numeric text input with increment and decrement stepper controls.

## Usage

```svelte
<script lang="ts">
  import NumberInput from '@lostgradient/cinder/number-input';
</script>

<NumberInput />
```

## Props

<!-- generated:props:start -->

| Prop           | Type               | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultValue` | `number` \| `null` | no       | —       | Initial value used when the component is uncontrolled or when the form is reset.                                                                                                                                                                                                                                                                                                                            |
| `description`  | `string`           | no       | —       | Helper text rendered below the input and associated via `aria-describedby`.                                                                                                                                                                                                                                                                                                                                 |
| `disabled`     | `boolean`          | no       | —       | When true, disables the input and stepper buttons, matching the native `disabled` attribute.                                                                                                                                                                                                                                                                                                                |
| `error`        | `string`           | no       | —       | Error message rendered below the input; also sets `aria-invalid` on the input.                                                                                                                                                                                                                                                                                                                              |
| `id`           | `string`           | yes      | —       | HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required.                                                                                                                                                                                                                                                                                                          |
| `label`        | `string`           | no       | —       | Visible label text rendered above the input and linked via `for`/`id`.                                                                                                                                                                                                                                                                                                                                      |
| `locale`       | `string`           | no       | —       | BCP 47 locale tag used for number formatting and parsing. Defaults to `navigator.language`.                                                                                                                                                                                                                                                                                                                 |
| `max`          | `number`           | no       | —       | Maximum permitted value; the stepper increment button disables when this bound is reached.                                                                                                                                                                                                                                                                                                                  |
| `min`          | `number`           | no       | —       | Minimum permitted value; the stepper decrement button disables when this bound is reached.                                                                                                                                                                                                                                                                                                                  |
| `name`         | `string`           | no       | —       | Name used to identify this field's value in form data.                                                                                                                                                                                                                                                                                                                                                      |
| `required`     | `boolean`          | no       | —       | Marks the input as required for form validation, matching the native `required` attribute.                                                                                                                                                                                                                                                                                                                  |
| `step`         | `number`           | no       | —       | Amount added or subtracted per stepper click or arrow-key press. Default `1`.                                                                                                                                                                                                                                                                                                                               |
| `value`        | `number` \| `null` | no       | —       | Bindable current numeric value, or `null` when the field is empty.                                                                                                                                                                                                                                                                                                                                          |
| `class`        | `(opaque)`         | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                     |
| `format`       | `(opaque)`         | no       | —       | Locale-aware formatting options passed to `Intl.NumberFormat`. Supports all `Intl.NumberFormatOptions` properties such as `style` (`'decimal'`, `'currency'`, `'percent'`, `'unit'`), `currency`, `minimumFractionDigits`, `maximumFractionDigits`, and `notation`. Defaults to locale-standard decimal formatting when omitted. Not expressible in JSON Schema; see the component types for the signature. |
| `onchange`     | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
