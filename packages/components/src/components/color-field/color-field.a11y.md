# Color Field — Accessibility Rationale

## What this component is

`color-field.svelte` is a **text-entry** color control. It accepts hex, `rgb()`, or `hsl()` strings, parses them on blur, and emits a canonical hex value via `onchange`. It pairs with `color-picker.svelte` (the visual surface) and `color-swatch-picker.svelte` (the fixed-palette surface). The field is the precision surface — when a user needs an exact `#3366FF`, the field is the right control.

## Swatch is decorative

The trailing color preview is a `<span aria-hidden="true">`. It reflects the most recently committed value but is not interactive and is not announced. Screen reader users do not lose anything by ignoring it — the canonical value lives in the `<input>` itself, which announces as a normal text field.

## Error wiring lives on the inner `<input>`

Parse failures are local to the field's input syntax: the user typed something that isn't a color, not that the application disagrees with their choice. The component sets `Input`'s own `error` prop, which wires `aria-invalid="true"` and `aria-describedby` to a visible error node. Semantic validation ("color must match brand palette") is the parent application's responsibility and belongs on a surrounding `<FormField error="...">` — `Input` allocates a distinct id when both errors are present so `aria-describedby` references both without collision.

## Why we validate on blur, not on every keystroke

Mid-typing values like `#a` or `rgb(255, 0,` aren't errors — they're intermediate states. Flashing `aria-invalid` while the user types creates a noisy experience for screen readers (every keystroke triggering an announcement) and a stressful one for sighted users (red error styling appearing and disappearing). Blur-time validation matches the cadence of human review and aligns with the native browser pattern for `<input type="email">`.

## Enter-key behavior

Pressing Enter always `preventDefault()`s the browser's submit and runs the commit pipeline synchronously. When `enterBehavior='commit-then-submit'` (the default), a successful commit then re-issues `form.requestSubmit()` so the surrounding form submits with the canonical committed value. This avoids the race where the browser submits before the field has had a chance to write its parsed value.

When `enterBehavior='commit-only'`, the field commits but never submits — useful in dialogs or multi-field flows where Enter has a different meaning.

The hidden form-mirror input's `.value` is updated synchronously before `requestSubmit`, so the form's submit handler reads the canonical hex even before Svelte's reactive effects flush.

## Form participation

When `name` is set, a sibling `<input type="hidden">` mirrors the committed hex value, so the field shows up in `FormData` and participates in native submission. When `name` is omitted, the field still works but does not contribute a payload — exactly like a native `<input>` without `name`.

A separate, always-rendered, nameless hidden anchor input handles `form` association for the reset listener — it has no submission side effect and exists only so the field knows which form to listen on.

## Limitations to document

- **No modern slash-alpha syntax.** The underlying parser does not accept `rgb(255 0 0 / 50%)` or `hsl(0 100% 50% / 0.5)`. Inputs in that form are rejected at the format gate. Use legacy comma syntax (`rgba(255, 0, 0, 0.5)`) or hex with alpha (`#ff000080`).
- **Cross-form remounting is unsupported.** The reset listener is wired at mount via a Svelte attachment. Moving the component to a different form at runtime requires unmounting and remounting.
- **Single-submitter heuristic.** The Enter handler picks the first non-disabled `[type=submit]` or unmarked `<button>` in document order. Edge cases like multiple eligible submitters with `formaction` priorities or `[type=image]` submitters are not fully replicated — consumers that need that fidelity should use `enterBehavior='commit-only'` and orchestrate submission themselves.
