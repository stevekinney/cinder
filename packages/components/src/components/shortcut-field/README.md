# ShortcutField

An accessible read-only keyboard shortcut recorder. Focus the field, press a combination, or press Escape to cancel capture.

## Usage

```svelte
<script lang="ts">
  import { ShortcutField } from '@lostgradient/cinder';
</script>

<ShortcutField label="Open command palette" value={['Meta', 'K']} />
```

`value` is an ordered list of platform key names. The field enters capture mode when focused, calls `onValueChange` with the recorded combination, and uses Escape to cancel capture. Supply `validate` to return an error message for a combination the application cannot accept; keep the previous value until a valid replacement is committed. Set `disabled` when the shortcut is unavailable rather than hiding the field.

`label` renders as visible field text by default, matching the field-control contract used by `FormField`, `Input`, and `PhoneInput`. Pass `labelVisible={false}` for a compact layout that needs a hidden label — the label stays in the DOM (visually hidden) and continues to name the field via `aria-labelledby`.

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default               | Description                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ---------- | -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`   | no       | —                     | Additional class merged with the component's root class.                                                                                                                                                                                                                                                                                                                                      |
| `disabled`      | `boolean`  | no       | `false`               | Set when the shortcut is unavailable. Defaults to `false`.                                                                                                                                                                                                                                                                                                                                    |
| `label`         | `string`   | no       | `"Keyboard shortcut"` | Accessible label for the shortcut field. Defaults to `'Keyboard shortcut'`. Rendered as visible field text by default (see `labelVisible`).                                                                                                                                                                                                                                                   |
| `labelVisible`  | `boolean`  | no       | `true`                | Whether `label` renders as visible field text. When `false`, the label remains in the DOM (associated via `aria-labelledby`) but is visually hidden with the shared `cinder-sr-only` treatment. Defaults to `true`, matching the field-control contract used by `FormField`, `Input`, and `PhoneInput`.                                                                                       |
| `value`         | `string`[] | no       | `[]`                  | Ordered list of platform key names for the recorded combination. Bindable—the component writes to it directly after a valid capture and on clear, so `bind:value` is the supported alternative to mirroring `onValueChange` yourself. Defaults to `[]`.                                                                                                                                       |
| `onValueChange` | `(opaque)` | no       | —                     | Called with the recorded combination when capture completes, and also called with an empty array when the user clears the field—handle the empty-array case to persist a removal, not only a successful capture. Not expressible in JSON Schema; see the component types for the signature.                                                                                                   |
| `validate`      | `(opaque)` | no       | —                     | Returns an error message for a combination the application cannot accept; the field keeps the previous value until a valid replacement is committed. Only checked on a keyboard capture—clearing the field bypasses it entirely, so a shortcut this rejects as required can still be removed via the clear action. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->
