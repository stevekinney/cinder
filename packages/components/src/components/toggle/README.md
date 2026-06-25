# Toggle

On/off switch input for binary settings, presented as a sliding pill control.

## Usage

```svelte
<script lang="ts">
  import Toggle from '@lostgradient/cinder/toggle';
</script>

<Toggle id="email-notifications" label="Email notifications" />
```

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default | Description                                                                                                                                                                                                        |
| --------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checked`       | `boolean`  | no       | —       | Whether the toggle is currently checked. Bindable — defaults to false.                                                                                                                                             |
| `class`         | `string`   | no       | —       | Additional class names merged with `.cinder-toggle` on the switch button.                                                                                                                                          |
| `disabled`      | `boolean`  | no       | —       | Prevents interaction when true. Sets `disabled` attribute.                                                                                                                                                         |
| `form`          | `string`   | no       | —       | Associates the hidden checkbox with a form by id, matching the native `form` attribute. Lets the toggle submit with a form it is not nested in. Ignored when `name` is unset.                                      |
| `hideLabel`     | `boolean`  | no       | —       | Visually hide the rendered label while keeping it as the accessible name. Use for icon-only or inline contexts.                                                                                                    |
| `id`            | `string`   | yes      | —       | Native id placed on the `<button>`; the rendered label uses `aria-labelledby` to name it (label id is derived as `${id}-label`).                                                                                   |
| `label`         | `string`   | yes      | —       | Visible label text. Always the accessible name, even when `hideLabel` is set. Required.                                                                                                                            |
| `name`          | `string`   | no       | —       | Form field name. When set, a hidden checkbox mirrors `checked` so the toggle participates in native form submission. Omit for purely client-side toggles (no hidden input is rendered, so there is zero overhead). |
| `value`         | `string`   | no       | —       | Value submitted for the hidden checkbox when `checked` and `name` is set. Mirrors native checkbox semantics: the pair `name=value` is sent only while checked. Defaults to `'on'`. Ignored when `name` is unset.   |
| `onValueChange` | `(opaque)` | no       | —       | Intercept a proposed checked state before the bindable value is written. Return a replacement value to transform it. Not expressible in JSON Schema; see the component types for the signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
