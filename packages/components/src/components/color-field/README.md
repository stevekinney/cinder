# ColorField

A text input that validates and normalizes hex, `rgb()`, and `hsl()` color strings into a canonical hex value emitted on blur. Compose it with `FormField` for label and external-error display, and pair it with `ColorPicker` when users need both visual selection and exact entry.

## Usage

```svelte
<script lang="ts">
  import ColorField from '@lostgradient/cinder/color-field';
  import FormField from '@lostgradient/cinder/form-field';

  let color = $state('#3366ff');
</script>

<FormField id="accent" label="Accent color">
  <ColorField id="accent" value={color} onchange={(next) => (color = next)} />
</FormField>
```

`value` is one-way: the parent sets it, the component reads it, and commits flow back through `onchange`. `bind:value` is intentionally not supported — wire up the callback explicitly so the data flow remains obvious.

## Behavior

- **Validation happens on blur**, not on every keystroke, so users can type intermediate values like `#ab` without seeing the error flicker.
- The emit value is always lowercase hex. Output is `#rrggbb` unless `alpha={true}` and the parsed value has partial alpha — then it's `#rrggbbaa`. Opaque inputs are never padded to `ff`.
- When `alpha={false}` (default), `#RRGGBBAA`, `rgba()`, and `hsla()` are accepted as input, but alpha is stripped on emit.
- The trailing color swatch reads `committedHex` only. It never reflects unparsed text, so a malformed string never paints arbitrary content into the DOM.
- Pressing **Enter** commits the value. With `enterBehavior='commit-then-submit'` (default), the field then calls `form.requestSubmit()` on the associated form. With `enterBehavior='commit-only'`, submission is suppressed.

## Controlled vs. uncontrolled

- **Controlled**: pass `value` and listen to `onchange`. The component never mutates `value`; it observes external changes via an effect. An externally-supplied invalid string preserves the visible text and raises an error rather than silently clearing.
- **Uncontrolled**: pass `defaultValue` instead. Subsequent state is owned by the component, and consumers observe commits through `onchange`.

Switching between controlled and uncontrolled at runtime is unsupported. The component captures `isControlled = value !== undefined` once at mount. In dev mode a runtime divergence logs a one-time `console.warn`.

## Form participation

The component renders a single sibling `<input type="hidden">` that serves two purposes. When `name` is set, that input carries the `name` attribute and mirrors the current committed hex so the value participates in native form submission. When `name` is not set, the same input still renders (without a `name`) and acts purely as the anchor used to attach a `reset` listener to the surrounding form. Either way, uncontrolled fields revert to `defaultValue` on form reset (no `onchange` is fired; reset is observable through native form events). Controlled fields do nothing on reset internally; the parent's reset handler updates `value` and the effect reconciles.

Parse errors propagate to the visible `<input>` via `setCustomValidity`, so invalid text participates in HTML constraint validation whether the user pressed Enter or clicked a submit button.

Moving the component across forms at runtime is not supported in v1.

## Limitations

- Modern `rgb(r g b / a)` and `hsl(h s l / a)` slash syntax is rejected by the parser. Only legacy comma-separated forms parse.
- `rgb()` percent components are rounded to the nearest 0–255 byte.
- `commit-then-submit` selects the first non-disabled `[type="submit"]` (or unmarked `<button>`) in document order, matching the common case but not every native browser nuance. Forms needing full fidelity should use `enterBehavior='commit-only'` and orchestrate `requestSubmit(submitter)` themselves.
- The component contributes a form value only when `name` is set — just like a native `<input>` without `name`. Pressing Enter on a field without a `name` still commits and submits, but no color appears in `FormData`.
- `oninput` is not exposed. The component owns the blur-time commit pipeline; intermediate keystrokes are intentionally not surfaced as a value callback.

## Errors and accessibility

- Parse errors are owned by `ColorField` and rendered by the inner `Input`. The native `<input>` carries `aria-invalid="true"` and an `aria-describedby` that references the inline error message.
- When wrapped in a `FormField` with its own `error="..."`, both error texts render and both ids appear in `aria-describedby` without collision — the `Input` allocates a distinct id when its own error would collide with the context's error id.
- The trailing swatch is decorative: it is `aria-hidden="true"`.

## Props

<!-- generated:props:start -->

| Prop             | Type                                      | Required | Default | Description                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alpha`          | `boolean`                                 | no       | —       | Accept and emit alpha when the parsed value has partial alpha. When `false` (default), `#RRGGBBAA` and `rgba()`/`hsla()` inputs are parsed but alpha is stripped on emit.                                                                                                                                                                   |
| `ariaLabel`      | `string`                                  | no       | —       | Accessible label applied directly to the inner `<input>` when no `FormField` wraps it.                                                                                                                                                                                                                                                      |
| `ariaLabelledby` | `string`                                  | no       | —       | Id of an external element that labels the inner `<input>`.                                                                                                                                                                                                                                                                                  |
| `class`          | `string`                                  | no       | —       | Additional classes merged onto the **outer wrapper** root (`.cinder-color-field`).                                                                                                                                                                                                                                                          |
| `defaultValue`   | `string`                                  | no       | —       | Initial value when uncontrolled. Accepts any allowed `formats` input.                                                                                                                                                                                                                                                                       |
| `disabled`       | `boolean`                                 | no       | —       | Disable the input.                                                                                                                                                                                                                                                                                                                          |
| `enterBehavior`  | `"commit-then-submit"` \| `"commit-only"` | no       | —       | Commit-on-Enter behavior. Default `'commit-then-submit'`: - `'commit-then-submit'`: Enter commits the value, then lets the form's native submission proceed via `requestSubmit`. - `'commit-only'`: Enter commits and `preventDefault()`s, suppressing form submission (useful in dialogs / multi-field flows where Enter must not submit). |
| `errorMessage`   | `string`                                  | no       | —       | Override the default parse-failure error message.                                                                                                                                                                                                                                                                                           |
| `formats`        | (`"hex"` \| `"rgb"` \| `"hsl"`)[]         | no       | —       | Accepted _input_ formats. Defaults to `['hex', 'rgb', 'hsl']`. Output is always hex.                                                                                                                                                                                                                                                        |
| `id`             | `string`                                  | yes      | —       | Inner `<input>` id. Required (mirrors Input).                                                                                                                                                                                                                                                                                               |
| `name`           | `string`                                  | no       | —       | Form field name. When set, the hidden mirror input contributes the current committed hex value to native form submission.                                                                                                                                                                                                                   |
| `placeholder`    | `string`                                  | no       | —       | Placeholder text for the inner `<input>`.                                                                                                                                                                                                                                                                                                   |
| `readonly`       | `boolean`                                 | no       | —       | Render the inner `<input>` as read-only.                                                                                                                                                                                                                                                                                                    |
| `required`       | `boolean`                                 | no       | —       | Mark the input as required for form submission and a11y.                                                                                                                                                                                                                                                                                    |
| `value`          | `string`                                  | no       | —       | Controlled value as a hex string. One-way: parent sets, child reads. Not bindable — use `onchange` to observe commits. Accepts any color string the configured `formats` allow when set externally.                                                                                                                                         |
| `onchange`       | `(opaque)`                                | no       | —       | Fires on successful blur-time commit when the canonical hex actually changes. Value callback by repo convention — not forwarded to the inner native `<input>`. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
