# Checkbox

Single boolean toggle for opt-in selections within forms or settings.

## Usage

```svelte
<script lang="ts">
  import Checkbox from '@lostgradient/cinder/checkbox';
</script>

<Checkbox />
```

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default | Description                                                                                                                                                                                                                                         |
| --------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checked`       | `boolean`  | no       | —       | Bound checked state.                                                                                                                                                                                                                                |
| `description`   | `string`   | no       | —       | Helper text displayed below the checkbox; wired via `aria-describedby`.                                                                                                                                                                             |
| `disabled`      | `boolean`  | no       | —       | Disables the checkbox.                                                                                                                                                                                                                              |
| `error`         | `string`   | no       | —       | Validation error message; sets `aria-invalid="true"` and `aria-describedby`.                                                                                                                                                                        |
| `id`            | `string`   | no       | —       | Unique identifier for label association and ARIA wiring. Optional: when omitted, a stable id is generated via `$props.id()` (or inherited from a FormField context), matching Input/Autocomplete. Provide it when you need a known id to reference. |
| `indeterminate` | `boolean`  | no       | —       | Bound indeterminate state. Mutually exclusive with `checked` visually.                                                                                                                                                                              |
| `label`         | `string`   | no       | —       | Visible label rendered in a `<label>` element associated via `for`.                                                                                                                                                                                 |
| `class`         | `(opaque)` | no       | —       | Extra class names merged with `.cinder-checkbox`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                        |
| `onValueChange` | `(opaque)` | no       | —       | Intercept a proposed checked state before the bindable value is written. Return a replacement value to transform it. Not expressible in JSON Schema; see the component types for the signature.                                                     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
