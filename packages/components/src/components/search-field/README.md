# SearchField

Dedicated text input with a clear button and search icon for filtering or querying.

## Usage

```svelte
<script lang="ts">
  import SearchField from '@lostgradient/cinder/search-field';
</script>

<SearchField />
```

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                                                                                                 |
| -------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultValue` | `string`   | no       | —       | Initial value for uncontrolled usage. Ignored when `value` is provided.                                                                                     |
| `disabled`     | `boolean`  | no       | —       | Disables the input and the clear button.                                                                                                                    |
| `id`           | `string`   | no       | —       | Stable id for the input element. Required when composing with `FormField`.                                                                                  |
| `name`         | `string`   | no       | —       | `name` attribute for form submission.                                                                                                                       |
| `placeholder`  | `string`   | no       | —       | Placeholder text.                                                                                                                                           |
| `readonly`     | `boolean`  | no       | —       | Marks the input as read-only; the clear button becomes inert.                                                                                               |
| `shortcut`     | `string`   | no       | —       | Optional keyboard shortcut hint (e.g. `'⌘K'`). Rendered as a trailing `<kbd aria-hidden="true">` badge. The shortcut itself is not wired by this component. |
| `value`        | `string`   | no       | —       | Controlled value. When provided, the field is fully controlled by the parent.                                                                               |
| `class`        | `(opaque)` | no       | —       | Additional class merged with `.cinder-search-field`. Not expressible in JSON Schema; see the component types for the signature.                             |
| `onclear`      | `(opaque)` | no       | —       | Fires when the clear button is clicked. Not expressible in JSON Schema; see the component types for the signature.                                          |
| `oninput`      | `(opaque)` | no       | —       | Fires on every keystroke with the current value. Not expressible in JSON Schema; see the component types for the signature.                                 |
| `onsearch`     | `(opaque)` | no       | —       | Fires when the native `search` event triggers (Enter or programmatic dispatch). Not expressible in JSON Schema; see the component types for the signature.  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
