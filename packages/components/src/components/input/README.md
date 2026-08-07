# Input

Single-line text input with support for labels, addons, validation states, and helper text.

## Usage

```svelte
<script lang="ts">
  import Input from '@lostgradient/cinder/input';

  let name = $state('');
</script>

<Input id="field" bind:value={name} label="Full name" placeholder="Jane Smith" />
{#if name}
  <p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">Hello, {name}!</p>
{/if}
```

## Props

<!-- generated:props:start -->

| Prop                   | Type                                                                                                            | Required | Default | Description                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                | `string`                                                                                                        | no       | —       | Custom class merged with `.cinder-input`.                                                                                                                                               |
| `description`          | `string`                                                                                                        | no       | —       | Helper text rendered below the input and associated via `aria-describedby`.                                                                                                             |
| `disabled`             | `boolean`                                                                                                       | no       | —       | When true, disables the input, matching the native `disabled` attribute.                                                                                                                |
| `error`                | `string`                                                                                                        | no       | —       | Error message rendered below the input; also sets `aria-invalid` on the input.                                                                                                          |
| `groupClassName`       | `string`                                                                                                        | no       | —       | Additional class names applied to the grouped control frame when leading or trailing content is present.                                                                                |
| `id`                   | `string`                                                                                                        | yes      | —       | HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required.                                                                                      |
| `label`                | `string`                                                                                                        | no       | —       | Visible label text rendered above the input and linked via `for`/`id`.                                                                                                                  |
| `labelVisible`         | `boolean`                                                                                                       | no       | —       | Whether the `label` is visibly rendered. Default `true`; set `false` to visually hide it while keeping it programmatically associated.                                                  |
| `leadingInteractive`   | `boolean`                                                                                                       | no       | —       | When true, the leading adornment is interactive and included in the accessibility tree. Default `false`.                                                                                |
| `required`             | `boolean`                                                                                                       | no       | —       | Marks the input as required for form validation, matching the native `required` attribute.                                                                                              |
| `trailingInteractive`  | `boolean`                                                                                                       | no       | —       | When true, the trailing adornment is interactive and included in the accessibility tree. Default `false`.                                                                               |
| `type`                 | `"number"` \| `"date"` \| `"email"` \| `"password"` \| `"search"` \| `"tel"` \| `"text"` \| `"time"` \| `"url"` | no       | —       | Input type controlling the browser's built-in validation and keyboard. Default `"text"`.                                                                                                |
| `inputAttachment`      | `(opaque)`                                                                                                      | no       | —       | Attachment for native input access and lifecycle-scoped listeners. Not expressible in JSON Schema; see the component types for the signature.                                           |
| `leading`              | `(opaque)`                                                                                                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                              |
| `onValueChange`        | `(opaque)`                                                                                                      | no       | —       | Notify after the bindable value has been committed. Not expressible in JSON Schema; see the component types for the signature.                                                          |
| `onValueChangeRequest` | `(opaque)`                                                                                                      | no       | —       | Intercept a proposed value before the bindable value is written. Return a replacement value to transform it. Not expressible in JSON Schema; see the component types for the signature. |
| `trailing`             | `(opaque)`                                                                                                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                              |
| `value`                | `(opaque)`                                                                                                      | yes      | —       | Bindable current text value of the input. Not expressible in JSON Schema; see the component types for the signature.                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
