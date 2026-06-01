# SegmentedControl

Toggle button row for switching between a small set of mutually exclusive options.

## Usage

```svelte
<script lang="ts">
  import SegmentedControl from 'cinder/segmented-control';
</script>

<SegmentedControl />
```

## Props

<!-- generated:props:start -->

| Prop                     | Type                           | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`                  | `string`                       | no       | —       | Additional class names merged with `.cinder-segmented-control`.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `density`                | `"toolbar"`                    | no       | —       | Opt the control into compact toolbar sizing so it lines up cleanly with sibling `Button` (size="sm"), `Chip` (density="toolbar"), and other toolbar elements. Toolbar density resolves to the compact `"sm"` font and padding scale — when set, any explicit `size` value is ignored and the resolved size (`data-cinder-size`) is `"sm"` — while pinning the option `min-block-size` to `--cinder-control-height-sm` so the bounding height matches sibling toolbar controls. |
| `detached`               | `boolean`                      | no       | —       | Render segments as detached individual buttons instead of a unified strip.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `disabled`               | `boolean`                      | no       | —       | Disable the whole control.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `disallowEmptySelection` | `boolean`                      | no       | —       | When true (default), clicking the already-selected option is a no-op. When false, clicking the selected option clears value to undefined.                                                                                                                                                                                                                                                                                                                                      |
| `fullWidth`              | `boolean`                      | no       | —       | Stretch the control to fill available width.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `hideLabel`              | `boolean`                      | no       | —       | Visually hide the label while keeping it available to assistive technology.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `id`                     | `string`                       | yes      | —       | Unique identifier for the control.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `label`                  | `string`                       | yes      | —       | Accessible label for the group.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `orientation`            | `"horizontal"` \| `"vertical"` | no       | —       | Layout orientation.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `selectionMode`          | `"single"` \| `"multiple"`     | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `size`                   | `"sm"` \| `"md"` \| `"lg"`     | no       | —       | Requested visual size of the control. Defaults to `"md"`. The resolved size is reflected as `data-cinder-size` on the root; when `density="toolbar"` is set, the resolved size is forced to `"sm"` and any explicit `size` value is ignored. `size="md"` option text uses `--cinder-text-sm`; `size="sm"` and `density="toolbar"` use `--cinder-text-xs`; `size="lg"` uses `--cinder-text-sm`.                                                                                 |
| `variant`                | `"radiogroup"` \| `"tablist"`  | no       | —       | ARIA interaction pattern. Use `tablist` when options switch visible panels.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `children`               | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                     |
| `onchange`               | `(opaque)`                     | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                     |
| `value`                  | `(opaque)`                     | no       | —       | A generically typed prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
