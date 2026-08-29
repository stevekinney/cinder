# FormField

Wraps an input, label, and helper or error text into a cohesive accessible field unit.

## Usage

```svelte
<script lang="ts">
  import FormField from '@lostgradient/cinder/form-field';
  import Input from '@lostgradient/cinder/input';

  let name = $state('');
</script>

<FormField id="full-name" label="Full name">
  <Input id="full-name" bind:value={name} placeholder="Jane Smith" />
</FormField>
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                 | Required | Default | Description                                                                                                                       |
| -------------- | ------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                             | no       | —       | Additional class merged with `.cinder-form-field`.                                                                                |
| `description`  | `string`                             | no       | —       | Helper text rendered below the control; wired into `aria-describedby`.                                                            |
| `disabled`     | `boolean`                            | no       | —       | Propagated to opted-in controls via context. Does not style FormField itself.                                                     |
| `error`        | `string`                             | no       | —       | Validation error; sets `aria-invalid="true"` on opted-in controls via context.                                                    |
| `id`           | `string`                             | yes      | —       | Required stable id — used for `<label for>`, description, error, and the child control's id via context.                          |
| `label`        | `string`                             | no       | —       | Visible label text. Omit only when the child control supplies its own accessible name, such as via aria-label or aria-labelledby. |
| `labelVisible` | `boolean`                            | no       | `true`  | Whether the label is visibly rendered. Set `false` to visually hide it while keeping it associated with the control.              |
| `managed`      | { by?: `string`; reason?: `string` } | no       | —       | Policy ownership metadata displayed without disabling the control.                                                                |
| `required`     | `boolean`                            | no       | —       | Renders a visual required marker and exposes `required: true` on the context.                                                     |
| `warning`      | `string`                             | no       | —       | Advisory for a legal but potentially risky value; does not mark the control invalid.                                              |
| `children`     | `(opaque)`                           | yes      | —       | Control(s) rendered inside the field. Not expressible in JSON Schema; see the component types for the signature.                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
