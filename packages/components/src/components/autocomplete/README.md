# Autocomplete

Free-form text input with suggestion hints.

## Usage

```svelte
<script lang="ts">
  import Autocomplete from 'cinder/autocomplete';
</script>

<Autocomplete />
```

## Props

<!-- generated:props:start -->

| Prop                    | Type       | Required | Default | Description                                                                                                                |
| ----------------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`                 | `string`   | no       | —       |                                                                                                                            |
| `description`           | `string`   | no       | —       |                                                                                                                            |
| `disabled`              | `boolean`  | no       | —       |                                                                                                                            |
| `emptyMessage`          | `string`   | no       | —       |                                                                                                                            |
| `error`                 | `string`   | no       | —       |                                                                                                                            |
| `id`                    | `string`   | no       | —       |                                                                                                                            |
| `label`                 | `string`   | no       | —       |                                                                                                                            |
| `loadingMessage`        | `string`   | no       | —       |                                                                                                                            |
| `maxVisibleSuggestions` | `number`   | no       | —       |                                                                                                                            |
| `minQueryLength`        | `number`   | no       | —       |                                                                                                                            |
| `placeholder`           | `string`   | no       | —       |                                                                                                                            |
| `readonly`              | `boolean`  | no       | —       |                                                                                                                            |
| `required`              | `boolean`  | no       | —       |                                                                                                                            |
| `value`                 | `string`   | no       | —       |                                                                                                                            |
| `oncomplete`            | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `oninput`               | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `suggestionSource`      | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->
