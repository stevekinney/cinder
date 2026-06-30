# Input

Single-line text input with support for labels, addons, validation states, and helper text.

## Usage

```svelte
<script lang="ts">
  import Input from '@lostgradient/cinder/input';
</script>

<Input />
```

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                                                                | Required | Default | Description                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`         | `string`                                                                                            | no       | —       | Helper text rendered below the input and associated via `aria-describedby`.                                                                                                             |
| `disabled`            | `boolean`                                                                                           | no       | —       | When true, disables the input, matching the native `disabled` attribute.                                                                                                                |
| `error`               | `string`                                                                                            | no       | —       | Error message rendered below the input; also sets `aria-invalid` on the input.                                                                                                          |
| `hideLabel`           | `boolean`                                                                                           | no       | —       | Visually hide the rendered `label` while keeping it programmatically associated.                                                                                                        |
| `id`                  | `string`                                                                                            | yes      | —       | HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required.                                                                                      |
| `label`               | `string`                                                                                            | no       | —       | Visible label text rendered above the input and linked via `for`/`id`.                                                                                                                  |
| `leadingInteractive`  | `boolean`                                                                                           | no       | —       | When true, the leading adornment is interactive and included in the accessibility tree. Default `false`.                                                                                |
| `required`            | `boolean`                                                                                           | no       | —       | Marks the input as required for form validation, matching the native `required` attribute.                                                                                              |
| `trailingInteractive` | `boolean`                                                                                           | no       | —       | When true, the trailing adornment is interactive and included in the accessibility tree. Default `false`.                                                                               |
| `type`                | `"number"` \| `"date"` \| `"email"` \| `"password"` \| `"search"` \| `"tel"` \| `"text"` \| `"url"` | no       | —       | Input type controlling the browser's built-in validation and keyboard. Default `"text"`.                                                                                                |
| `class`               | `(opaque)`                                                                                          | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                 |
| `leading`             | `(opaque)`                                                                                          | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                              |
| `onValueChange`       | `(opaque)`                                                                                          | no       | —       | Intercept a proposed value before the bindable value is written. Return a replacement value to transform it. Not expressible in JSON Schema; see the component types for the signature. |
| `trailing`            | `(opaque)`                                                                                          | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                              |
| `value`               | `(opaque)`                                                                                          | yes      | —       | Bindable current text value of the input. Not expressible in JSON Schema; see the component types for the signature.                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
