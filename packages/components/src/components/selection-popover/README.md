# SelectionPopover

Floating panel that appears on text selection to offer contextual formatting or actions.

## Usage

```svelte
<script lang="ts">
  import SelectionPopover from 'cinder/selection-popover';
</script>

<SelectionPopover />
```

## Props

<!-- generated:props:start -->

| Prop              | Type       | Required | Default | Description                                                                                                                |
| ----------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`   | no       | —       | Additional class names merged with `.cinder-selection-popover`.                                                            |
| `id`              | `string`   | yes      | —       | Unique identifier for the popover.                                                                                         |
| `open`            | `boolean`  | no       | —       | Whether the popover is visible.                                                                                            |
| `oncancel`        | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onclose`         | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `oncommentsubmit` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onexpand`        | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `position`        | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
