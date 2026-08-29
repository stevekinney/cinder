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
  onValueChange={handleChange}
/>
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  Value: {quantity ?? 'empty'}
</p>
```

## Props

<!-- generated:props:start -->

| Prop              | Type               | Required | Default | Description                                                                                                                                   |
| ----------------- | ------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `adornment`       | `string`           | no       | —       | Optional non-interactive text rendered before the stepper controls.                                                                           |
| `class`           | `string`           | no       | —       |                                                                                                                                               |
| `description`     | `string`           | no       | —       |                                                                                                                                               |
| `disabled`        | `boolean`          | no       | —       |                                                                                                                                               |
| `error`           | `string`           | no       | —       |                                                                                                                                               |
| `id`              | `string`           | yes      | —       |                                                                                                                                               |
| `label`           | `string`           | no       | —       |                                                                                                                                               |
| `locale`          | `string`           | no       | —       |                                                                                                                                               |
| `max`             | `number`           | no       | —       |                                                                                                                                               |
| `min`             | `number`           | no       | —       |                                                                                                                                               |
| `name`            | `string`           | no       | —       |                                                                                                                                               |
| `required`        | `boolean`          | no       | —       |                                                                                                                                               |
| `step`            | `number`           | no       | —       |                                                                                                                                               |
| `value`           | `number` \| `null` | no       | —       |                                                                                                                                               |
| `format`          | `(opaque)`         | no       | —       | Locale-aware formatting options passed to `Intl.NumberFormat`. Not expressible in JSON Schema; see the component types for the signature.     |
| `inputAttachment` | `(opaque)`         | no       | —       | Attachment for native input access and lifecycle-scoped listeners. Not expressible in JSON Schema; see the component types for the signature. |
| `onValueChange`   | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
