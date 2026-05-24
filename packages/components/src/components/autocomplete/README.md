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

| Prop                    | Type       | Required | Default | Description         |
| ----------------------- | ---------- | -------- | ------- | ------------------- |
| `class`                 | `string`   | no       | —       |                     |
| `description`           | `string`   | no       | —       |                     |
| `disabled`              | `boolean`  | no       | —       |                     |
| `emptyMessage`          | `string`   | no       | —       |                     |
| `error`                 | `string`   | no       | —       |                     |
| `id`                    | `string`   | no       | —       |                     |
| `label`                 | `string`   | no       | —       |                     |
| `loadingMessage`        | `string`   | no       | —       |                     |
| `maxVisibleSuggestions` | `number`   | no       | —       |                     |
| `minQueryLength`        | `number`   | no       | —       |                     |
| `placeholder`           | `string`   | no       | —       |                     |
| `readonly`              | `boolean`  | no       | —       |                     |
| `required`              | `boolean`  | no       | —       |                     |
| `value`                 | `string`   | no       | —       |                     |
| `oncomplete`            | `(opaque)` | —        | —       | function-or-snippet |
| `oninput`               | `(opaque)` | —        | —       | function-or-snippet |
| `suggestionSource`      | `(opaque)` | —        | —       | function-or-snippet |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->
