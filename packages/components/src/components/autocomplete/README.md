# Autocomplete

Free-form text input with suggestion hints.

## Usage

```svelte
<script lang="ts">
  import Autocomplete from '@lostgradient/cinder/autocomplete';
</script>

<Autocomplete />
```

## Props

<!-- generated:props:start -->

| Prop                    | Type       | Required | Default | Description                                                                                                                |
| ----------------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`                 | `string`   | no       | —       | Additional class names merged onto the root wrapper element.                                                               |
| `description`           | `string`   | no       | —       | Helper text rendered below the input and associated via `aria-describedby`.                                                |
| `disabled`              | `boolean`  | no       | —       | When true, disables the input and prevents interaction, matching the native `disabled` attribute.                          |
| `emptyMessage`          | `string`   | no       | —       | Message shown in the listbox when the suggestion source returns no results. Default `"No suggestions"`.                    |
| `error`                 | `string`   | no       | —       | Error message rendered below the input; also sets `aria-invalid` on the input.                                             |
| `id`                    | `string`   | no       | —       | HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes.                                   |
| `label`                 | `string`   | no       | —       | Visible label text rendered above the input and linked via `for`/`id`.                                                     |
| `loadingMessage`        | `string`   | no       | —       | Message shown in the listbox while the suggestion source is fetching results. Default `"Loading suggestions"`.             |
| `maxVisibleSuggestions` | `number`   | no       | —       | Maximum number of suggestions rendered in the listbox at once. Default `50`.                                               |
| `minQueryLength`        | `number`   | no       | —       | Minimum number of characters the user must type before suggestions are requested. Default `1`.                             |
| `placeholder`           | `string`   | no       | —       | Placeholder text shown inside the input when it is empty.                                                                  |
| `readonly`              | `boolean`  | no       | —       | When true, the input value cannot be changed by the user, matching the native `readonly` attribute.                        |
| `required`              | `boolean`  | no       | —       | Marks the input as required for form validation, matching the native `required` attribute.                                 |
| `value`                 | `string`   | no       | —       | Bindable current text value of the input.                                                                                  |
| `oncomplete`            | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `oninput`               | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `suggestionSource`      | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->
