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
| `error`       | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and is wired via `aria-describedby`. |
| `label`       | `string`   | no       | —       | Visible label rendered in a `<label>` associated via `for`.                               |
| `options`     | `object`[] | yes      | —       | Options to render as `<option>` children.                                                 |
| `class`       | `(opaque)` | —        | —       | unknown-shape                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
