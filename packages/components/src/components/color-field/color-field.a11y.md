# Color Field — Accessibility Rationale

## What this component is — and what it isn't

`color-field.svelte` is a **text** color entry control. Users type or paste `#hex`, `rgb()`, or `hsl()` strings; the field parses them on blur and emits a canonical hex value. It is intentionally _not_ a visual color picker — that role belongs to `color-picker.svelte` and `color-swatch-picker.svelte`. For the most accessible color entry experience, pair this field with a picker; users who can type a hex code will, and users who can't can still reach for the visual surface.

## The swatch is decorative

The trailing color swatch is a `<span aria-hidden="true">` with the parsed color set as `background-color`. It is announced to screen readers as part of the inner `<input>` rather than as a separate control. The inline style reads from `committedHex` only — never from the raw `visibleText` or the controlled `value` prop — so it can never reflect unsanitized user input.

## Error wiring through the shared field-control contract

The component delegates all label, description, and `aria-describedby` wiring to the composed `<Input>`, which itself uses the shared field-control utilities and the `<FormField>` context. When a parse error is active, ColorField sets the inner input's `error` prop, which produces `aria-invalid="true"` and a referenced error-message id.

**Dual-error composition is partial in v1.** When ColorField sits inside a `<FormField>` that also raises a semantic error (e.g., "color must match brand palette"), `<Input>` allocates its own error id to avoid collision — but only the field's own parse error id appears in `aria-describedby`. The FormField error `<p>` still renders so sighted users see both messages, but assistive tech reading the input's described-by hears only the parse error. Fixing this requires teaching `<Input>` to include both ids in `composeDescribedBy`, which is out of scope for this component. Consumers needing strict dual-error announcement should render only one error at a time (either field-level or wrapper-level, not both) until that upstream change lands.

ColorField does **not** raise semantic validation errors. The only error it owns is the parse-failure error. Anything else — required, brand-palette restrictions, contrast thresholds — lives on the wrapping `<FormField>` and stays the parent's responsibility.

## Validation on blur, not on every keystroke

The field validates input on `blur` (and on Enter), not on every `input` event. This lets a user type `#a`, pause to think, and type `bcdef` without watching their field flicker red. Live validation during typing would also be hostile to assistive tech that announces `aria-invalid` changes mid-edit.

## Enter behavior is explicit

Pressing Enter inside the field runs the same commit pipeline as a blur. The keydown handler always calls `preventDefault()` first — the field owns whether the form submits, not the browser. After commit:

- With the default `enterBehavior='commit-then-submit'`: a successful commit (including an unchanged or cleared value) calls `requestSubmit` on the associated form, with the first non-disabled submit-typed button or input as the submitter. A parse failure short-circuits submission.
- With `enterBehavior='commit-only'`: the field never submits; the surrounding form is responsible for picking up the committed value via its hidden mirror or via `onchange`.

Submitter discovery is scoped to the field's own form via `anchorInput.form.querySelector(...)`. Submitters associated by HTML `form="<id>"` rather than by descendant relationship are not detected in v1 — consumers needing that should orchestrate `requestSubmit` themselves with `enterBehavior='commit-only'`.

## Form participation and reset

The hidden mirror input renders the canonical hex when valid and an empty string when a parse error is active. This means an external submit during a parse-error state submits `''` rather than a stale prior value. ColorField does **not** otherwise block native form submission — if the visible text is invalid and a sibling submit button is clicked, the form will submit with an empty color rather than blocking. Consumers needing hard validation gates should add a form-level submit handler that reads the mirror and refuses to submit when it is empty, or attach `setCustomValidity` from a wrapping component.

When the surrounding form fires `reset`, an uncontrolled field reverts to `defaultValue` (or empty when none was supplied); a controlled field defers entirely to the parent.

## Documented limitations

- Modern `rgb(r g b / a)` slash-syntax is rejected. We accept only legacy comma-separated syntax. Consumers can pre-normalize before binding if their input source produces slash-alpha.
- The component does not move between forms after mount. The reset listener attaches once on mount and detaches on unmount. Cross-form remounting via portals is unsupported in v1.
- Runtime switching between controlled (`value` set) and uncontrolled (`value === undefined`) is unsupported and emits a one-time `console.warn` in development.
