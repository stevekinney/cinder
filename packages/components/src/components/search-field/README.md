# SearchField

A SearchField component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import SearchField from 'cinder/search-field';
</script>

<SearchField />
```

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                                                                                                 |
| -------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultValue` | `string`   | no       | —       | Initial value for uncontrolled usage. Ignored when `value` is provided.                                                                                     |
| `shortcut`     | `string`   | no       | —       | Optional keyboard shortcut hint (e.g. `'⌘K'`). Rendered as a trailing `<kbd aria-hidden="true">` badge. The shortcut itself is not wired by this component. |
| `value`        | `string`   | no       | —       | Controlled value. When provided, the field is fully controlled by the parent.                                                                               |
| `class`        | `(opaque)` | —        | —       | unknown-shape                                                                                                                                               |
| `onclear`      | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                         |
| `oninput`      | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                         |
| `onsearch`     | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
