# ColorField

A text input that validates and normalizes hex, `rgb()`, and `hsl()` color strings into a canonical hex value. Pairs with `ColorPicker` (visual selection) and `ColorSwatchPicker` (fixed palette) for combined entry surfaces.

## Usage

```svelte
<script lang="ts">
  import ColorField from 'cinder/color-field';
  import FormField from 'cinder/form-field';

  let color = $state('#3366ff');
</script>

<FormField label="Brand color" controlId="brand-color">
  <ColorField
    id="brand-color"
    value={color}
    onchange={(next) => (color = next)}
    name="brand-color"
  />
</FormField>
```

## Behavior

- **Blur-time validation.** Typing intermediate values like `#a` or `rgb(255, 0,` does not raise an error. The field parses and commits on blur.
- **Canonical output.** Successful parses are normalized to lowercase hex. Short hex (`#f00`) expands to `#ff0000`. `rgb()` / `hsl()` round to 8-bit channels.
- **Alpha.** When `alpha={false}` (default), inputs with alpha are accepted but the alpha channel is stripped on emit. When `alpha={true}`, partial-alpha inputs emit `#rrggbbaa` and opaque inputs still emit `#rrggbb` (no `ff` padding).
- **Enter key.** Always `preventDefault()`s the native submit and commits synchronously. When `enterBehavior='commit-then-submit'` (default), a successful commit then re-issues `form.requestSubmit()` with the canonical value already written to the hidden mirror.
- **Form reset.** Uncontrolled fields revert to `defaultValue` on form reset; controlled fields defer to the parent's reset handling. Reset never fires `onchange`.

## Props

<!-- generated:props:start -->

| Prop            | Type                                      | Required | Default | Description                                                                                                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alpha`         | `boolean`                                 | no       | —       | Accept and emit alpha when the parsed alpha is partial. When `false` (default), inputs with alpha (`#RRGGBBAA`, `rgba(...)`, `hsla(...)`) are still accepted but the alpha channel is stripped on emit.                                                                                                                       |
| `class`         | `string`                                  | no       | —       | Additional classes merged onto the outer wrapper (`.cinder-color-field`).                                                                                                                                                                                                                                                     |
| `defaultValue`  | `string`                                  | no       | —       | Initial value when uncontrolled. Accepts any allowed `formats` input.                                                                                                                                                                                                                                                         |
| `disabled`      | `boolean`                                 | no       | —       | Disable the field.                                                                                                                                                                                                                                                                                                            |
| `enterBehavior` | `"commit-then-submit"` \| `"commit-only"` | no       | —       | Behavior when the user presses Enter in the field: - `'commit-then-submit'` (default): commit the value, then allow the form's native submission to proceed (`requestSubmit()`). - `'commit-only'`: commit and `preventDefault()` the submission. Useful in dialogs / multi-field flows where Enter must not submit the form. |
| `errorMessage`  | `string`                                  | no       | —       | Override the default parse-failure error message.                                                                                                                                                                                                                                                                             |
| `formats`       | `"hex"` \| `"rgb"` \| `"hsl"`[]           | no       | —       | Accepted _input_ formats. Defaults to all three. Output is always hex. Modern slash-alpha syntax (e.g. `rgb(255 0 0 / 50%)`) is unsupported.                                                                                                                                                                                  |
| `id`            | `string`                                  | yes      | —       | Inner `<input>` id. Required (mirrors Input).                                                                                                                                                                                                                                                                                 |
| `name`          | `string`                                  | no       | —       | Form field name. When set, a hidden sibling `<input>` mirrors the current committed hex value for native form submission.                                                                                                                                                                                                     |
| `placeholder`   | `string`                                  | no       | —       | Placeholder text for the inner `<input>`.                                                                                                                                                                                                                                                                                     |
| `value`         | `string`                                  | no       | —       | Controlled value. One-way: parent sets, child reads via `onchange`. Not `$bindable` — use `onchange` to observe changes.                                                                                                                                                                                                      |
| `onchange`      | `(opaque)`                                | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->

## Limitations

- **No modern slash-alpha syntax.** `rgb(255 0 0 / 50%)` and `hsl(0 100% 50% / 0.5)` are rejected. Use legacy comma syntax (`rgba(255, 0, 0, 0.5)`) or hex with alpha (`#ff000080`).
- **No `oninput` callback.** The field intentionally exposes only `onchange`. Use `bind:value` on a wrapping form if you need keystroke-level reactivity (or compose with `Input` directly).
- **No popover / picker.** That belongs on `ColorPicker` and `ColorSwatchPicker`.
- **No cross-form remounting at runtime.** Move the component by remounting it.
- **Mode is captured at mount.** Switching between controlled (`value` set) and uncontrolled (`value` undefined) after mount is unsupported — the field logs a DEV warning and preserves prior state.
