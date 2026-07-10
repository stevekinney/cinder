# TagInput

Free-form token entry field that turns committed text into removable tags while keeping native input, form, and accessibility wiring intact.

## Usage

```svelte
<script lang="ts">
  import { TagInput } from '@lostgradient/cinder/tag-input';
</script>
```

## Guidance

For native forms, pass both `name` and `commitOnSubmit` when the expected path is
"type a tag, click Save." `TagInput` commits a valid pending draft during the
form's submit capture phase, so `new FormData(form).getAll(name)` includes the
same values as the hidden inputs. Invalid, duplicate, or over-limit drafts use
the existing inline validation path and block that submit attempt.

### Use When

- Collecting zero or more short free-form values such as labels, emails, or technologies.
- Letting users review and remove committed values inline before submitting a form.

### Avoid When

- Users must choose from a fixed option list — use combobox instead.
- The value is a single free-form string rather than a list — use input instead.

## Props

<!-- generated:props:start -->

| Prop               | Type                                                                                                          | Required | Default | Description                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowDuplicates`  | `boolean`                                                                                                     | no       | —       | Allow the same trimmed tag value to appear more than once.                                                                                                 |
| `aria-describedby` | `string` \| `null`                                                                                            | no       | —       | Additional description ids composed into the visible input aria-describedby chain.                                                                         |
| `aria-invalid`     | `false` \| `true` \| `"true"` \| `"false"` \| `"grammar"` \| `"spelling"` \| `null`                           | no       | —       | Manual invalid-state override used when no inline validation message or FormField invalid state is active.                                                 |
| `aria-label`       | `string` \| `null`                                                                                            | no       | —       | Accessible label applied when no labelled-by chain is present.                                                                                             |
| `aria-labelledby`  | `string` \| `null`                                                                                            | no       | —       | Element ids that label both the text input and the committed-tag listbox.                                                                                  |
| `autocapitalize`   | `"off"` \| `"on"` \| `"characters"` \| `"none"` \| `"sentences"` \| `"words"` \| `null`                       | no       | —       | Autocapitalization hint forwarded to the visible text input.                                                                                               |
| `class`            | `string`                                                                                                      | no       | —       | Additional class merged onto the root element.                                                                                                             |
| `commitOnSubmit`   | `boolean`                                                                                                     | no       | —       | Commit a non-empty pending draft before the parent form submits.                                                                                           |
| `defaultValue`     | `string`[]                                                                                                    | no       | —       | Initial tags for uncontrolled usage. Ignored after mount.                                                                                                  |
| `disabled`         | `boolean`                                                                                                     | no       | —       | Disable the input and chip removal affordances.                                                                                                            |
| `enterkeyhint`     | `"enter"` \| `"done"` \| `"go"` \| `"next"` \| `"previous"` \| `"search"` \| `"send"` \| `null`               | no       | —       | Virtual-keyboard Enter hint forwarded to the visible text input.                                                                                           |
| `id`               | `string`                                                                                                      | no       | —       | Stable id for the visible text input. Falls back to FormField context or a generated id.                                                                   |
| `inputmode`        | `"email"` \| `"tel"` \| `"url"` \| `"none"` \| `"search"` \| `"text"` \| `"numeric"` \| `"decimal"` \| `null` | no       | —       | Virtual-keyboard input mode forwarded to the visible text input.                                                                                           |
| `max`              | `number`                                                                                                      | no       | —       | Maximum number of tags allowed. Non-finite values disable the cap.                                                                                         |
| `maxlength`        | `number` \| `null`                                                                                            | no       | —       | Maximum pending-text length forwarded to the visible text input.                                                                                           |
| `name`             | `string`                                                                                                      | no       | —       | Hidden input name used for native form submission; one hidden field is rendered per tag.                                                                   |
| `placeholder`      | `string` \| `null`                                                                                            | no       | —       | Placeholder text shown while the pending tag input is empty.                                                                                               |
| `readonly`         | `boolean`                                                                                                     | no       | —       | Render the pending-tag input as read-only and make committed tags non-removable.                                                                           |
| `spellcheck`       | `false` \| `true` \| `"true"` \| `"false"` \| `null`                                                          | no       | —       | Spellcheck setting forwarded to the visible text input.                                                                                                    |
| `value`            | `string`[]                                                                                                    | no       | —       | Controlled tags. When provided, the parent owns the tag array.                                                                                             |
| `autocomplete`     | `(opaque)`                                                                                                    | no       | —       | Autocomplete hint forwarded to the visible text input. Not expressible in JSON Schema; see the component types for the signature.                          |
| `delimiter`        | `(opaque)`                                                                                                    | no       | —       | Key that commits the current input into a tag. Enter always commits separately. Not expressible in JSON Schema; see the component types for the signature. |
| `onblur`           | `(opaque)`                                                                                                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                 |
| `onchange`         | `(opaque)`                                                                                                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                 |
| `onfocus`          | `(opaque)`                                                                                                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                 |
| `oninput`          | `(opaque)`                                                                                                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                 |
| `onkeydown`        | `(opaque)`                                                                                                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                 |
| `validate`         | `(opaque)`                                                                                                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
