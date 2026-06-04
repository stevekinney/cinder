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

| Prop          | Type       | Required | Default | Description                                                                                                              |
| ------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `description` | `string`   | no       | —       | Helper text rendered below the control; wired via `aria-describedby`.                                                    |
| `disabled`    | `boolean`  | no       | —       | Disables the control.                                                                                                    |
| `error`       | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and is wired via `aria-describedby`.                                |
| `id`          | `string`   | yes      | —       | Unique identifier — required for label association and ARIA wiring.                                                      |
| `label`       | `string`   | no       | —       | Visible label rendered in a `<label>` associated via `for`.                                                              |
| `required`    | `boolean`  | no       | —       | Marks the control required and sets the native `required` attribute.                                                     |
| `class`       | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `options`     | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `value`       | `(opaque)` | no       | —       | A generically typed prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
