# ColorSwatchPicker

Presents a fixed palette of color swatches for constrained color selection.

## Usage

```svelte
<script lang="ts">
  import ColorSwatchPicker from '@lostgradient/cinder/color-swatch-picker';
</script>

<ColorSwatchPicker />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                           | Required | Default | Description                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                                       | no       | —       | Additional classes merged into the listbox `<ul>`.                                                                                                                                                                                 |
| `defaultValue` | `string`                                       | no       | —       | Initial selected color for uncontrolled use. Ignored when `value` is set.                                                                                                                                                          |
| `disabled`     | `boolean`                                      | no       | —       | Disables the entire listbox. Keyboard activation and clicks are ignored.                                                                                                                                                           |
| `label`        | `string`                                       | yes      | —       | Accessible name for the listbox. Required — `role="listbox"` needs a label so screen readers can announce the control's purpose.                                                                                                   |
| `layout`       | `"grid"` \| `"stack"`                          | no       | —       | Layout direction. Default `'grid'`. Note: grid layout uses one-dimensional DOM-order navigation for both ArrowLeft/Right and ArrowUp/Down. True column-aware navigation is not implemented in v1 — see a11y memo.                  |
| `shape`        | `"circle"` \| `"square"`                       | no       | —       | Visual shape of each swatch. Default `'circle'`.                                                                                                                                                                                   |
| `size`         | `"xs"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | no       | —       | Swatch dimension token. Default `'md'`.                                                                                                                                                                                            |
| `value`        | `string`                                       | no       | —       | Controlled selected color. When provided, the parent owns the state.                                                                                                                                                               |
| `colors`       | `(opaque)`                                     | yes      | —       | Palette to render. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                      |
| `indicator`    | `(opaque)`                                     | no       | —       | Snippet that replaces the default check-icon indicator on the selected swatch. Receives the active swatch and the computed contrast color for the icon. Not expressible in JSON Schema; see the component types for the signature. |
| `onchange`     | `(opaque)`                                     | no       | —       | Fired when the selected swatch changes. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
