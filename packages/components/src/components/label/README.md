# Label

Accessible form label that associates descriptive text with its input element.

## Usage

```svelte
<script lang="ts">
  import Label from '@lostgradient/cinder/label';
</script>

<Label />
```

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                    |
| ---------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled` | `boolean`  | no       | —       | When true, render the label in the disabled color treatment.                                                                                                   |
| `for`      | `string`   | yes      | —       | The id of the form control this label labels. Sets `for` on the rendered `<label>`.                                                                            |
| `required` | `boolean`  | no       | —       | When true, append a visual indicator that the field is required.                                                                                               |
| `children` | `(opaque)` | yes      | —       | The label text or composed content. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `class`    | `(opaque)` | no       | —       | Additional class names merged with `.cinder-label`. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
