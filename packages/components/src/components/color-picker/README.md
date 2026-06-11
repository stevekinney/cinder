# ColorPicker

Full-featured input for selecting a color via hue, saturation, lightness, and hex entry.

## Usage

```svelte
<script lang="ts">
  import ColorPicker from '@lostgradient/cinder/color-picker';
</script>

<ColorPicker />
```

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                                                                                                                                                                |
| -------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alpha`        | `boolean`  | no       | —       | Enable the alpha slider and emit `#rrggbbaa`. Default `false`.                                                                                                                                                             |
| `class`        | `string`   | no       | —       | Additional classes merged onto the root element.                                                                                                                                                                           |
| `defaultValue` | `string`   | no       | —       | Initial color when `value` is not bound. Same input formats as `value`.                                                                                                                                                    |
| `disabled`     | `boolean`  | no       | —       | Disable interaction across the picker.                                                                                                                                                                                     |
| `label`        | `string`   | no       | —       | Accessible label for the picker. Default `'Color picker'`.                                                                                                                                                                 |
| `name`         | `string`   | no       | —       | Form field name. When set, a hidden input mirrors the current value for form submission.                                                                                                                                   |
| `swatches`     | `string`[] | no       | —       | Optional palette of preset colors rendered below the picker.                                                                                                                                                               |
| `value`        | `string`   | no       | —       | Bindable value. Reading the value yields a hex string (`#rrggbb`, or `#rrggbbaa` when `alpha` is true). Setting the value accepts hex, `rgb()`, `rgba()`, `hsl()`, or `hsla()` input; invalid input is normalized to `''`. |
| `onchange`     | `(opaque)` | no       | —       | Fired on commit (pointer up, swatch click, slider key). Not expressible in JSON Schema; see the component types for the signature.                                                                                         |
| `oninput`      | `(opaque)` | no       | —       | Fired on every intermediate update (drag, slider key, swatch click). Not expressible in JSON Schema; see the component types for the signature.                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
