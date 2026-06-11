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

| Prop                  | Type                                                                                                | Required | Default | Description                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `description`         | `string`                                                                                            | no       | —       |                                                                                                                            |
| `disabled`            | `boolean`                                                                                           | no       | —       |                                                                                                                            |
| `error`               | `string`                                                                                            | no       | —       |                                                                                                                            |
| `id`                  | `string`                                                                                            | yes      | —       |                                                                                                                            |
| `label`               | `string`                                                                                            | no       | —       |                                                                                                                            |
| `leadingInteractive`  | `boolean`                                                                                           | no       | —       |                                                                                                                            |
| `required`            | `boolean`                                                                                           | no       | —       |                                                                                                                            |
| `trailingInteractive` | `boolean`                                                                                           | no       | —       |                                                                                                                            |
| `type`                | `"number"` \| `"date"` \| `"email"` \| `"password"` \| `"search"` \| `"tel"` \| `"text"` \| `"url"` | no       | —       |                                                                                                                            |
| `class`               | `(opaque)`                                                                                          | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `leading`             | `(opaque)`                                                                                          | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `trailing`            | `(opaque)`                                                                                          | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `value`               | `(opaque)`                                                                                          | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
