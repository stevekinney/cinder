# Select

A Select component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Select from 'cinder/select';
</script>

<Select />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                               |
| ------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `description` | `string`   | no       | —       | Helper text rendered below the control; wired via `aria-describedby`.                     |
| `disabled`    | `boolean`  | no       | —       | Disables the control.                                                                     |
| `error`       | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and is wired via `aria-describedby`. |
| `id`          | `string`   | yes      | —       | Unique identifier — required for label association and ARIA wiring.                       |
| `label`       | `string`   | no       | —       | Visible label rendered in a `<label>` associated via `for`.                               |
| `required`    | `boolean`  | no       | —       | Marks the control required and sets the native `required` attribute.                      |
| `class`       | `(opaque)` | —        | —       | unknown-shape                                                                             |
| `options`     | `(opaque)` | —        | —       | unknown-shape                                                                             |
| `value`       | `(opaque)` | —        | —       | unknown-shape                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
