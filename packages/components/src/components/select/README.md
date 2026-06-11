# Select

Native-style dropdown select for choosing a single option from a predefined list.

## Usage

```svelte
<script lang="ts">
  import Select from '@lostgradient/cinder/select';
</script>

<Select />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                           |
| ------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description` | `string`   | no       | —       | Helper text rendered below the control; wired via `aria-describedby`.                                                                                 |
| `disabled`    | `boolean`  | no       | —       | Disables the control.                                                                                                                                 |
| `error`       | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and is wired via `aria-describedby`.                                                             |
| `id`          | `string`   | yes      | —       | Unique identifier — required for label association and ARIA wiring.                                                                                   |
| `label`       | `string`   | no       | —       | Visible label rendered in a `<label>` associated via `for`.                                                                                           |
| `required`    | `boolean`  | no       | —       | Marks the control required and sets the native `required` attribute.                                                                                  |
| `class`       | `(opaque)` | no       | —       | Extra class names merged with `.cinder-select-field`. Not expressible in JSON Schema; see the component types for the signature.                      |
| `options`     | `(opaque)` | yes      | —       | Options to render as `<option>` children. The sole inference source for T. Not expressible in JSON Schema; see the component types for the signature. |
| `value`       | `(opaque)` | no       | —       | Bound selected value. `undefined` when nothing is selected. Not expressible in JSON Schema; see the component types for the signature.                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
