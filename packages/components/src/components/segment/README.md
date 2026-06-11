# Segment

Individual option inside a SegmentedControl that renders the button, wires the value, and forwards leading/trailing decorations.

## Usage

```svelte
<script lang="ts">
  import { Segment } from '@lostgradient/cinder/segment';
</script>
```

## Guidance

### Use When

- Authoring SegmentedControl children declaratively so consumers can compose icons, labels, and badges per segment.
- Mixing disabled and enabled segments inside a single radiogroup/tablist where each segment carries its own metadata.

### Avoid When

- Building a standalone toggle button — use Button or Toggle instead.
- Selecting one option from a long list — use Select or Combobox instead.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                                                             |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Custom class merged with `.cinder-segmented-control-option`.                                                                                                                                            |
| `controls` | `string`   | no       | —       | ID of the panel this segment controls — only meaningful when the parent `SegmentedControl` uses `variant="tablist"`.                                                                                    |
| `disabled` | `boolean`  | no       | —       | Disable just this segment (independent of the control-level `disabled`).                                                                                                                                |
| `children` | `(opaque)` | yes      | —       | The segment's label content. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                 |
| `leading`  | `(opaque)` | no       | —       | Optional decorative content rendered before the label, inside `aria-hidden`. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `trailing` | `(opaque)` | no       | —       | Optional decorative content rendered after the label, inside `aria-hidden`. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.  |
| `value`    | `(opaque)` | yes      | —       | Value this segment represents. Must be unique within the parent control. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                        |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
