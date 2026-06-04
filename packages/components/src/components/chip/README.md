# Chip

Compact token for issue labels, free-form tags, applied filters, selected entities, and removable or toggleable metadata.

Use `Chip mode="display"` for issue labels and tags; use Badge for attached counts, statuses, and compact annotations.

## Usage

```svelte
<script lang="ts">
  import Chip from '@lostgradient/cinder/chip';
</script>

<Chip label="frontend" mode="display" variant="info" />
```

## Props

<!-- generated:props:start -->

| Prop              | Type                                                                              | Required | Default | Description                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`                                                                          | no       | —       |                                                                                                                            |
| `density`         | `"toolbar"`                                                                       | no       | —       |                                                                                                                            |
| `disabled`        | `boolean`                                                                         | no       | —       |                                                                                                                            |
| `label`           | `string`                                                                          | yes      | —       |                                                                                                                            |
| `mode`            | `"display"` \| `"toggle"` \| `"removable"`                                        | no       | —       |                                                                                                                            |
| `pressed`         | `boolean`                                                                         | no       | —       |                                                                                                                            |
| `removeAriaLabel` | `string`                                                                          | no       | —       |                                                                                                                            |
| `size`            | `"sm"` \| `"md"`                                                                  | no       | —       |                                                                                                                            |
| `variant`         | `"neutral"` \| `"success"` \| `"warning"` \| `"danger"` \| `"info"` \| `"accent"` | no       | —       |                                                                                                                            |
| `leadingIcon`     | `(opaque)`                                                                        | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onpressedchange` | `(opaque)`                                                                        | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onremove`        | `(opaque)`                                                                        | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
