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

| Prop            | Type                                                  | Required | Default | Description                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alpha`         | `boolean`                                             | no       | —       | Show the alpha slider. When `false` (default), a parsed input's alpha channel is forced fully opaque. This gate is uniform across every `format` — it is not a hex-only concern. Independently of `alpha`, a non-hex `format`'s alpha-emission syntax (the `/ a` segment) only appears when the resulting alpha is actually below 1.    |
| `class`         | `string`                                              | no       | —       | Additional classes merged onto the root element.                                                                                                                                                                                                                                                                                        |
| `disabled`      | `boolean`                                             | no       | —       | Disable interaction across the picker.                                                                                                                                                                                                                                                                                                  |
| `format`        | `"hex"` \| `"rgb"` \| `"hsl"` \| `"hwb"` \| `"oklch"` | no       | —       | Output color format for the committed/emitted value. Default `'hex'`. Purely additive — existing consumers relying on the hex default are unaffected. `value` stays a plain string regardless of format.                                                                                                                                |
| `label`         | `string`                                              | no       | —       | Accessible label for the picker. Default `'Color picker'`.                                                                                                                                                                                                                                                                              |
| `name`          | `string`                                              | no       | —       | Form field name. When set, a hidden input mirrors the current value for form submission.                                                                                                                                                                                                                                                |
| `swatches`      | `string`[]                                            | no       | —       | Optional palette of preset colors rendered below the picker.                                                                                                                                                                                                                                                                            |
| `value`         | `string`                                              | no       | —       | Bindable value. Reading the value yields a string in the configured `format` (`#rrggbb`/`#rrggbbaa` for the `'hex'` default, or modern space-separated CSS Color 4 syntax with slash alpha for the others). Setting the value accepts hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, or `hwb()` input; invalid input is normalized to `''`. |
| `onValueChange` | `(opaque)`                                            | no       | —       | Fired on every intermediate update (drag, slider key, swatch click). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                         |
| `onValueCommit` | `(opaque)`                                            | no       | —       | Fired on commit (pointer up, swatch click, slider key). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
