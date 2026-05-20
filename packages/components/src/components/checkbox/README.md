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

| Prop            | Type       | Required | Default | Description                                                                  |
| --------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------- |
| `checked`       | `boolean`  | no       | —       | Bound checked state.                                                         |
| `description`   | `string`   | no       | —       | Helper text displayed below the checkbox; wired via `aria-describedby`.      |
| `disabled`      | `boolean`  | no       | —       | Disables the checkbox.                                                       |
| `error`         | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and `aria-describedby`. |
| `id`            | `string`   | yes      | —       | Unique identifier — required for label association and ARIA wiring.          |
| `indeterminate` | `boolean`  | no       | —       | Bound indeterminate state. Mutually exclusive with `checked` visually.       |
| `label`         | `string`   | no       | —       | Visible label rendered in a `<label>` element associated via `for`.          |
| `class`         | `(opaque)` | —        | —       | unknown-shape                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
