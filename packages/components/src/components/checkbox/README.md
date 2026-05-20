# Checkbox

A Checkbox component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Checkbox from 'cinder/checkbox';
</script>

<Checkbox />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                  |
| ------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------- |
| `description` | `string`   | no       | —       | Helper text displayed below the checkbox; wired via `aria-describedby`.      |
| `error`       | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and `aria-describedby`. |
| `label`       | `string`   | no       | —       | Visible label rendered in a `<label>` element associated via `for`.          |
| `class`       | `(opaque)` | —        | —       | unknown-shape                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
