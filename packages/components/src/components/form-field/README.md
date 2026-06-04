# FormField

Wraps an input, label, and helper or error text into a cohesive accessible field unit.

## Usage

```svelte
<script lang="ts">
  import FormField from '@lostgradient/cinder/form-field';
</script>

<FormField />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                |
| ------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Additional class merged with `.cinder-form-field`.                                                                         |
| `description` | `string`   | no       | —       | Helper text rendered below the control; wired into `aria-describedby`.                                                     |
| `disabled`    | `boolean`  | no       | —       | Propagated to opted-in controls via context. Does not style FormField itself.                                              |
| `error`       | `string`   | no       | —       | Validation error; sets `aria-invalid="true"` on opted-in controls via context.                                             |
| `id`          | `string`   | yes      | —       | Required stable id — used for `<label for>`, description, error, and the child control's id via context.                   |
| `label`       | `string`   | yes      | —       | Visible label text. Required — the primitive's whole purpose is label association.                                         |
| `required`    | `boolean`  | no       | —       | Renders a visual required marker and exposes `required: true` on the context.                                              |
| `children`    | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
