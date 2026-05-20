# Textarea

A Textarea component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Textarea from 'cinder/textarea';
</script>

<Textarea />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description` | `string`   | no       | —       | Helper text displayed below the textarea; wired via `aria-describedby`.                                                                                                                                                                                                                                                                                |
| `error`       | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and `aria-describedby`.                                                                                                                                                                                                                                                                           |
| `label`       | `string`   | no       | —       | Visible label rendered in a `<label>` element associated via `for`.                                                                                                                                                                                                                                                                                    |
| `showCount`   | `boolean`  | no       | —       | When `true` AND `maxlength` is set, renders a live character counter (`{value.length}/{maxlength}`) below the textarea. The counter element is wired into `aria-describedby` so screen readers announce it as part of the field's description, and it is also placed inside an `aria-live="polite"` region so updates are announced as the user types. |
| `class`       | `(opaque)` | —        | —       | unknown-shape                                                                                                                                                                                                                                                                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
