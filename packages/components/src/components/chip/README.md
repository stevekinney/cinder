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
| `class`           | `string`                                                                          | no       | —       | Additional class names merged onto the chip element.                                                                       |
| `density`         | `"toolbar"`                                                                       | no       | —       | When set to `"toolbar"`, opts the chip into compact toolbar sizing to align with sibling toolbar controls.                 |
| `disabled`        | `boolean`                                                                         | no       | —       | Toggle mode only. When true, disables the toggle button and prevents interaction.                                          |
| `label`           | `string`                                                                          | yes      | —       | Visible text content of the chip.                                                                                          |
| `mode`            | `"display"` \| `"toggle"` \| `"removable"`                                        | no       | —       | Rendering and interaction mode. Default `"display"`.                                                                       |
| `pressed`         | `boolean`                                                                         | no       | —       | Toggle mode only. Whether the chip is currently in the pressed (selected) state. Reflected as `aria-pressed`.              |
| `removeAriaLabel` | `string`                                                                          | no       | —       | Removable mode only. Accessible label for the remove button. Defaults to `Remove` followed by the chip's `label`.          |
| `size`            | `"sm"` \| `"md"`                                                                  | no       | —       | Size of the chip. Default `"md"`.                                                                                          |
| `variant`         | `"neutral"` \| `"success"` \| `"warning"` \| `"danger"` \| `"info"` \| `"accent"` | no       | —       | Color variant applied to the chip. Default `"neutral"`.                                                                    |
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
