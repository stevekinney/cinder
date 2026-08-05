# NumberInput

Numeric text input with increment and decrement stepper controls.

## Usage

```svelte
<script lang="ts">
  import NumberInput from '@lostgradient/cinder/number-input';

  let quantity = $state<number | null>(1);

  function handleChange(value: number | null) {
    quantity = value;
  }
</script>

<NumberInput
  id="quantity"
  label="Quantity"
  value={quantity}
  min={1}
  max={99}
  onchange={handleChange}
/>
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  Value: {quantity ?? 'empty'}
</p>
```

## Props

<!-- generated:props:start -->

| Prop              | Type               | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`           | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                             |
| `description`     | `string`           | no       | —       | Helper text rendered below the input and associated via `aria-describedby`.                                                                                                                                                                                                                                                                                                                                 |
| `disabled`        | `boolean`          | no       | —       | When true, disables the input and stepper buttons, matching the native `disabled` attribute.                                                                                                                                                                                                                                                                                                                |
| `error`           | `string`           | no       | —       | Error message rendered below the input; also sets `aria-invalid` on the input.                                                                                                                                                                                                                                                                                                                              |
| `id`              | `string`           | yes      | —       | HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required.                                                                                                                                                                                                                                                                                                          |
| `label`           | `string`           | no       | —       | Visible label text rendered above the input and linked via `for`/`id`.                                                                                                                                                                                                                                                                                                                                      |
| `locale`          | `string`           | no       | —       | BCP 47 locale tag used for number formatting and parsing. Defaults to the nearest LocaleProvider locale, then `navigator.language` after mount and `en-US` during server rendering.                                                                                                                                                                                                                         |
| `max`             | `number`           | no       | —       | Maximum permitted value; the stepper increment button disables when this bound is reached.                                                                                                                                                                                                                                                                                                                  |
| `min`             | `number`           | no       | —       | Minimum permitted value; the stepper decrement button disables when this bound is reached.                                                                                                                                                                                                                                                                                                                  |
| `name`            | `string`           | no       | —       | Name used to identify this field's value in form data.                                                                                                                                                                                                                                                                                                                                                      |
| `required`        | `boolean`          | no       | —       | Marks the input as required for form validation, matching the native `required` attribute.                                                                                                                                                                                                                                                                                                                  |
| `step`            | `number`           | no       | —       | Amount added or subtracted per stepper click or arrow-key press. Default `1`.                                                                                                                                                                                                                                                                                                                               |
| `value`           | `number` \| `null` | no       | —       | Bindable current numeric value, or `null` when the field is empty.                                                                                                                                                                                                                                                                                                                                          |
| `format`          | `(opaque)`         | no       | —       | Locale-aware formatting options passed to `Intl.NumberFormat`. Supports all `Intl.NumberFormatOptions` properties such as `style` (`'decimal'`, `'currency'`, `'percent'`, `'unit'`), `currency`, `minimumFractionDigits`, `maximumFractionDigits`, and `notation`. Defaults to locale-standard decimal formatting when omitted. Not expressible in JSON Schema; see the component types for the signature. |
| `inputAttachment` | `(opaque)`         | no       | —       | Attachment for native input access and lifecycle-scoped listeners. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                               |
| `onchange`        | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
