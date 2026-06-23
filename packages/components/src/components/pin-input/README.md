# PinInput

Segmented one-time-code input with auto-advance, paste distribution, and optional masking.

## Usage

```svelte
<script lang="ts">
  import PinInput from '@lostgradient/cinder/pin-input';
  let code = $state('');
</script>

<PinInput id="otp" bind:value={code} label="Verification code" />
```

## Props

<!-- generated:props:start -->

| Prop              | Type                            | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aria-label`      | `string`                        | no       | —       | Group accessible name when no visible `label` is supplied.                                                                                                                                                                                                                                                                                                                                                                                    |
| `aria-labelledby` | `string`                        | no       | —       | Space-separated list of ids that label the group when no `label` is supplied.                                                                                                                                                                                                                                                                                                                                                                 |
| `class`           | `string`                        | no       | —       | Extra class names appended to the root group element.                                                                                                                                                                                                                                                                                                                                                                                         |
| `description`     | `string`                        | no       | —       | Optional description text rendered below the segments.                                                                                                                                                                                                                                                                                                                                                                                        |
| `disabled`        | `boolean`                       | no       | —       | Disable every segment and the hidden input.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `error`           | `string`                        | no       | —       | Optional error message; sets `aria-invalid="true"` on every segment.                                                                                                                                                                                                                                                                                                                                                                          |
| `hideLabel`       | `boolean`                       | no       | —       | Visually hide the rendered `label` while keeping it programmatically associated.                                                                                                                                                                                                                                                                                                                                                              |
| `id`              | `string`                        | yes      | —       | Stable id used as the segment id prefix and as the hidden input id.                                                                                                                                                                                                                                                                                                                                                                           |
| `label`           | `string`                        | no       | —       | Visible group label rendered above the segments.                                                                                                                                                                                                                                                                                                                                                                                              |
| `length`          | `number`                        | no       | —       | Number of segments to render. Normalized to an integer in `[1, 12]`; non-finite or out-of-range values fall back to `6`.                                                                                                                                                                                                                                                                                                                      |
| `masked`          | `boolean`                       | no       | —       | Render segments as password-style fields without changing the emitted value.                                                                                                                                                                                                                                                                                                                                                                  |
| `mode`            | `"numeric"` \| `"alphanumeric"` | no       | —       | Character set accepted in each segment. Defaults to `'numeric'`.                                                                                                                                                                                                                                                                                                                                                                              |
| `name`            | `string`                        | no       | —       | Form-control name applied to the hidden `<input>` that submits with the form.                                                                                                                                                                                                                                                                                                                                                                 |
| `required`        | `boolean`                       | no       | —       | Mark the group as required for assistive technology.                                                                                                                                                                                                                                                                                                                                                                                          |
| `value`           | `string`                        | no       | —       | Bindable code value. Defaults to an empty string. **No write-back normalization.** The bound prop reflects exactly what the consumer set — it is NOT mutated back to the filtered/length-capped value. The displayed and submitted value is normalized via `$derived`, but the binding itself is left untouched. This is intentional: the consumer owns the source of truth, and silent mutation of a bound prop is a surprising side-effect. |
| `autocomplete`    | `(opaque)`                      | no       | —       | `autocomplete` value applied to the first segment. Defaults to `'one-time-code'` so iOS and Android can autofill SMS codes. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                        |
| `onchange`        | `(opaque)`                      | no       | —       | Fires only for user-initiated committed value changes (typing, paste, autofill, backspace). Never fires for external prop synchronization. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
