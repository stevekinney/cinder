# ColorField

A text input that validates and normalizes hex, `rgb()`, and `hsl()` color strings. Parses on blur, emits a canonical hex value via `onchange`, and renders a trailing color swatch reflecting the committed value. Designed to compose inside `<FormField>` for label and error wiring.

## Usage

```svelte
<script lang="ts">
  import ColorField from 'cinder/color-field';
  import FormField from 'cinder/form-field';

  let color = $state('#ff8800');
</script>

<FormField label="Brand color" controlId="brand-color">
  <ColorField id="brand-color" value={color} onchange={(next) => (color = next)} />
</FormField>
```

## Behavior contract

- **Validation runs on blur**, not on every keystroke. Users can type intermediate values like `#a` without a flicker of red.
- **Output is always lowercase hex.** With `alpha={true}` and a partially-transparent input, output is `#rrggbbaa`; with `alpha={false}` or a fully-opaque input, output is `#rrggbb`.
- **Controlled mode is optimistic.** When the user commits a new value in controlled mode, the field immediately updates its visible text, swatch, and hidden mirror so a synchronous form submit reads the new value. The parent then reconciles on the next `value` prop update; if the parent ignores `onchange`, the field stays in the optimistic state until the parent issues a real prop change.
- **Enter behaves like blur + submit** by default. With `enterBehavior='commit-only'`, Enter commits without submitting.
- **Hidden mirror clears on parse error.** When `name` is set and the field is in a parse-error state, the hidden submission input renders `''` rather than a stale prior value.
- **Form reset reverts uncontrolled fields to `defaultValue`**; controlled fields defer to the parent.

## Documented limitations

- Modern `rgb(r g b / a)` slash-syntax is rejected. Use the legacy comma-separated form.
- Submitter discovery for Enter scans descendants of the field's own form only. External submitters associated via `form="<id>"` are not detected in v1.
- Cross-form remounting is unsupported in v1.
- Runtime switching between controlled and uncontrolled modes is unsupported; emits a one-time `console.warn` in development.
- Empty `formats={[]}` is treated as developer error and falls back to all three formats with a one-time `console.warn`.

## Props

<!-- generated:props:start -->

| Prop            | Type                                      | Required | Default | Description                                                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alpha`         | `boolean`                                 | no       | —       | Accept and emit alpha when partial. When `false` (default), `#rrggbbaa` is accepted on input but the alpha byte is stripped on emit.                                                                                                                         |
| `class`         | `string`                                  | no       | —       | Additional classes merged onto the outer wrapper (`.cinder-color-field`).                                                                                                                                                                                    |
| `defaultValue`  | `string`                                  | no       | —       | Initial value when uncontrolled. Accepts any of the allowed `formats`.                                                                                                                                                                                       |
| `disabled`      | `boolean`                                 | no       | —       | Disable the input.                                                                                                                                                                                                                                           |
| `enterBehavior` | `"commit-then-submit"` \| `"commit-only"` | no       | —       | Commit-on-Enter behavior. Default `'commit-then-submit'`: - `'commit-then-submit'`: Enter commits, then calls `requestSubmit` on the associated form for any non-failure outcome. - `'commit-only'`: Enter commits but never submits, regardless of outcome. |
| `errorMessage`  | `string`                                  | no       | —       | Override the default parse-failure error message.                                                                                                                                                                                                            |
| `formats`       | `"hex"` \| `"rgb"` \| `"hsl"`[]           | no       | —       | Accepted _input_ formats. Defaults to `['hex', 'rgb', 'hsl']`. Output is always hex.                                                                                                                                                                         |
| `id`            | `string`                                  | yes      | —       | Stable id applied to the inner `<input>`. Required (mirrors `Input`).                                                                                                                                                                                        |
| `name`          | `string`                                  | no       | —       | Form field name. When set, a hidden sibling `<input>` mirrors the current committed canonical hex for form submission. The hidden input renders an empty value while a parse error is active so external submits do not send a stale prior value.            |
| `placeholder`   | `string`                                  | no       | —       | Placeholder text for the inner `<input>`.                                                                                                                                                                                                                    |
| `value`         | `string`                                  | no       | —       | Controlled value. One-way: parent passes, child reads. NOT `$bindable`; pair with `onchange`. Reading the value yields a canonical hex string (`#rrggbb`, or `#rrggbbaa` when `alpha={true}` and `a < 1`).                                                   |
| `onchange`      | `(opaque)`                                | —        | —       | function-or-snippet                                                                                                                                                                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
