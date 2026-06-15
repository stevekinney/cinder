# Textarea

Multi-line text input for longer freeform content with optional resize control.

## Usage

```svelte
<script lang="ts">
  import Textarea from '@lostgradient/cinder/textarea';
</script>

<Textarea />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description` | `string`   | no       | —       | Helper text displayed below the textarea; wired via `aria-describedby`.                                                                                                                                                                                                                                                                                |
| `disabled`    | `boolean`  | no       | —       | Disables the textarea.                                                                                                                                                                                                                                                                                                                                 |
| `error`       | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and `aria-describedby`.                                                                                                                                                                                                                                                                           |
| `id`          | `string`   | yes      | —       | Unique identifier — required for label association and ARIA wiring.                                                                                                                                                                                                                                                                                    |
| `label`       | `string`   | no       | —       | Visible label rendered in a `<label>` element associated via `for`.                                                                                                                                                                                                                                                                                    |
| `maxlength`   | `number`   | no       | —       | Maximum character count. Passed through to the native `maxlength` attribute and used as the denominator for the `showCount` counter.                                                                                                                                                                                                                   |
| `required`    | `boolean`  | no       | —       | Marks the field as required. Passed through to the native `required` attribute.                                                                                                                                                                                                                                                                        |
| `rows`        | `number`   | no       | —       | Number of visible text rows. Defaults to 4.                                                                                                                                                                                                                                                                                                            |
| `showCount`   | `boolean`  | no       | —       | When `true` AND `maxlength` is set, renders a live character counter (`{value.length}/{maxlength}`) below the textarea. The counter element is wired into `aria-describedby` so screen readers announce it as part of the field's description, and it is also placed inside an `aria-live="polite"` region so updates are announced as the user types. |
| `class`       | `(opaque)` | no       | —       | Extra class names merged with `.cinder-textarea`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                           |
| `value`       | `(opaque)` | no       | —       | Bound value of the textarea. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
