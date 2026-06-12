# SecretValueField

Masked display for API keys, tokens, and webhook secrets with accessible copy action.

## Overview

`SecretValueField` renders a secret credential in masked form by default, with a one-click copy action and an optional reveal toggle. It is designed for settings pages and API key management screens where you need to:

- Show a newly-created secret exactly once (use `initiallyRevealed`).
- Display an existing key masked, with only safe metadata (prefix/suffix) visible.
- Let users copy the value without it appearing in accessible labels, titles, or data attributes.

**Security contract:** The `value` prop is never written to any passive attribute. The copy announcement says only "Copied" and never contains the value. Reveal is opt-in and off by default.

## Usage

```svelte
<script lang="ts">
  import { SecretValueField } from '@lostgradient/cinder/secret-value-field';
</script>

<!-- Newly-created API key: show once, prompt to copy -->
<SecretValueField
  value="example_live_abc123xyz"
  label="API Key"
  prefix="example_live_"
  initiallyRevealed={true}
/>

<!-- Existing masked key with last-4 suffix for identification -->
<SecretValueField
  value="example_live_abc123xyz"
  label="API Key"
  prefix="example_live_"
  suffix="xyz"
/>

<!-- Allow the user to reveal the full value on demand -->
<SecretValueField value="example_whsec_abc123xyz" label="Webhook Secret" allowReveal={true} />
```

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowReveal`       | `boolean`  | no       | —       | When true, allows the user to reveal/hide the full secret. Opt-in; false by default for security.                                                                                                                                                                                                                                                              |
| `class`             | `string`   | no       | —       | Additional CSS classes applied to the root element.                                                                                                                                                                                                                                                                                                            |
| `confirmDuration`   | `number`   | no       | —       | Duration in milliseconds to show the copy confirmation state. Default 1500.                                                                                                                                                                                                                                                                                    |
| `copiedLabel`       | `string`   | no       | —       | Accessible label announced after a successful copy. Defaults to "Copied".                                                                                                                                                                                                                                                                                      |
| `initiallyRevealed` | `boolean`  | no       | —       | Shows the full unmasked value on initial render. This is an explicit one-time reveal for the "secret was just created, copy it now" flow and is INDEPENDENT of `allowReveal`: it does not add a reveal/hide toggle, it just starts unmasked. Only set this when the surrounding UI makes the one-time exposure intentional (e.g. a "copy your new key" panel). |
| `label`             | `string`   | no       | —       | Accessible label for the field and copy button region. Defaults to "Secret value".                                                                                                                                                                                                                                                                             |
| `prefix`            | `string`   | no       | —       | Visible prefix shown before the masked region (e.g. `example_live_`). Does not contain the secret.                                                                                                                                                                                                                                                             |
| `suffix`            | `string`   | no       | —       | Visible suffix shown after the masked region (e.g. last 4 chars "a3f9"). Does not contain the secret.                                                                                                                                                                                                                                                          |
| `value`             | `string`   | yes      | —       | The secret value to copy. Never rendered in attributes or visible text post-copy. Required.                                                                                                                                                                                                                                                                    |
| `warning`           | `(opaque)` | no       | —       | Optional advisory content rendered below the field (e.g. "Copy this now; it will not be shown again"). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

## Accessibility

`SecretValueField` keeps the secret out of all accessible attributes. See `secret-value-field.a11y.md` for the full accessibility contract.

- The value display has an `aria-label` that names the field and its state ("masked" or "revealed") without including the value itself.
- Copy success is announced by a `role="status" aria-live="polite"` region with `aria-atomic="true"`. The announcement says "Copied" (or your custom `copiedLabel`), never the value.
- The reveal toggle uses `aria-pressed` to communicate its state, and its `aria-label` flips between "Reveal {label}" and "Hide {label}".
- Prefix and suffix elements carry `aria-hidden="true"` to prevent double-reading; the value region's `aria-label` already describes the field.
- The row of controls is wrapped in `role="group"` labelled via `aria-labelledby` pointing to the field label.
