# SegmentedControl

A SegmentedControl component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import SegmentedControl from 'cinder/segmented-control';
</script>

<SegmentedControl />
```

## Props

<!-- generated:props:start -->

| Prop                     | Type                           | Required | Default | Description                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                  | `string`                       | no       | —       | Additional class names merged with `.cinder-segmented-control`.                                                                                                                                                                   |
| `density`                | `"toolbar"`                    | no       | —       | Opt the control into a shared toolbar height (via `--cinder-control-height-sm`) so it lines up cleanly with sibling `Button` (size="sm"), `Chip` (density="toolbar"), and other toolbar elements. Default rendering is unchanged. |
| `detached`               | `boolean`                      | no       | —       | Render segments as detached individual buttons instead of a unified strip.                                                                                                                                                        |
| `disabled`               | `boolean`                      | no       | —       | Disable the whole control.                                                                                                                                                                                                        |
| `disallowEmptySelection` | `boolean`                      | no       | —       | When true (default), clicking the already-selected option is a no-op. When false, clicking the selected option clears value to undefined.                                                                                         |
| `fullWidth`              | `boolean`                      | no       | —       | Stretch the control to fill available width.                                                                                                                                                                                      |
| `hideLabel`              | `boolean`                      | no       | —       | Visually hide the label while keeping it available to assistive technology.                                                                                                                                                       |
| `id`                     | `string`                       | yes      | —       | Unique identifier for the control.                                                                                                                                                                                                |
| `label`                  | `string`                       | yes      | —       | Accessible label for the group.                                                                                                                                                                                                   |
| `orientation`            | `"horizontal"` \| `"vertical"` | no       | —       | Layout orientation.                                                                                                                                                                                                               |
| `selectionMode`          | `"single"` \| `"multiple"`     | no       | —       |                                                                                                                                                                                                                                   |
| `size`                   | `"sm"` \| `"md"` \| `"lg"`     | no       | —       | Visual size of the control.                                                                                                                                                                                                       |
| `variant`                | `"radiogroup"` \| `"tablist"`  | no       | —       | ARIA interaction pattern. Use `tablist` when options switch visible panels.                                                                                                                                                       |
| `onchange`               | `(opaque)`                     | —        | —       | function-or-snippet                                                                                                                                                                                                               |
| `value`                  | `(opaque)`                     | —        | —       | generic-type-parameter                                                                                                                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
