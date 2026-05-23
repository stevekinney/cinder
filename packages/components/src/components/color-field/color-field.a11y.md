# Color Field — Accessibility Rationale

## What this component is — and what it isn't

`color-field.svelte` is the **precision** counterpart to `color-picker.svelte`. The picker exists to let users graze visually across a color space; the field exists to accept an exact color value via keyboard entry. Neither replaces the other, and most production forms benefit from offering both side-by-side.

The field itself is a thin composition: an inner `<input>` (delivered by `Input`) plus a parser/normalizer that runs on blur. Everything that makes the inner input accessible — `aria-invalid`, `aria-describedby`, label association, native `disabled` and `required` behavior — flows through `Input` and the `FormField` context. ColorField does not duplicate that wiring.

## Why validation happens on blur, not on every keystroke

A user typing `#ff8800` will pass through `#`, `#f`, `#ff`, `#ff8` — every intermediate state is unparseable. Surfacing an "invalid color" error after each keystroke would mean the form screams at the user for the entire duration of their intent. Blur-time validation lets the user finish typing before we decide whether to flag the value, which matches how `<input type="email">` and most real-world form controls behave.

The trade-off is that an invalid committed value is not surfaced until focus moves elsewhere. That trade is the right one for a free-form text field — keyboard users typically tab away from the input to confirm their choice, and assistive technology announces the error at the moment they leave the field.

## Error ownership

There are two kinds of errors a color field can have. The first is a **parse error** — the text doesn't form a valid hex, rgb(), or hsl() string. The second is a **semantic validation error** — the value parses, but the consumer rejects it ("must match brand palette"). These have different owners.

Parse errors are owned by `ColorField` itself. The component gives the inner `Input` the current parse error, and `Input` wires `aria-invalid="true"` on the native `<input>` and renders the message in a `<p aria-live="polite">` referenced by `aria-describedby`. Consumers never need to know about parse failures — the field surfaces them automatically.

Semantic errors are owned by the wrapping `FormField`. When a consumer passes `error="..."` to `FormField`, that error renders in the form-field error region and feeds the form-field context. `Input` is smart enough to allocate a distinct id for its own (parse) error when the two would collide, so both messages render. The "both ids in `aria-describedby`" guarantee depends on the wrapping `FormField` carrying the same `id` as the `ColorField` — that's how the form-field context plumbs through.

Beyond ARIA, parse errors also participate in HTML constraint validation. The component calls `setCustomValidity` on the visible `<input>` whenever the parse state changes, so native form validation can block submit attempts while a parse error is present.

## The trailing swatch is decorative

The trailing color swatch is rendered into Input's `trailing` snippet slot as a `<span aria-hidden="true">`. It exists to give sighted users a quick visual confirmation that their input parsed to roughly the color they expected. It is not a button, not a focusable element, and not interactive — clicking it does nothing. Assistive technology ignores it entirely.

Two consequences. First, the swatch's color comes from `committedHex`, not from the visible text. A user can type `not-a-color`, and the swatch stays the previous committed color (or empty) — at no point does the component paint arbitrary user input into a CSS variable. Second, the field's only interactive surface is the inner `<input>`. Screen readers describing the control announce the input's label, the value, and any error — there is nothing extra to interpret.

## Enter key behavior — and why it's explicit

Pressing Enter inside a text input has a default behavior: submit the surrounding form. That's fine when the input's value is what the form needs, and not fine when the input has unprocessed state. ColorField has unprocessed state during typing: `visibleText` is what the user has typed, but `committedHex` (the value the form should submit) only updates on blur or Enter.

To avoid the race where the form submits with a stale hidden mirror, ColorField intercepts Enter, calls `preventDefault` first, runs the commit pipeline synchronously, writes the canonical hex to the hidden mirror's DOM value directly (not through Svelte's effect queue), and then — if `enterBehavior` is `'commit-then-submit'` — calls `form.requestSubmit()`. The submitter selection picks the first non-disabled `[type=submit]` (or unmarked `<button>`) in document order, which matches native default-submitter behavior for the common case.

In dialogs and multi-field flows where Enter should commit but not submit, consumers pass `enterBehavior='commit-only'`. The pipeline still runs synchronously; the form just doesn't dispatch a submit event. Consumers can read the canonical hex from the hidden mirror in their own submit handler if they want full control.

## Form participation and form reset

The component always renders a single sibling `<input type="hidden">` that serves two purposes. When `name` is set, that input carries the `name` attribute and mirrors the current committed hex so the value participates in native form submission. When `name` is not set, the same input still renders (without a `name`) and acts purely as the anchor for form association — it gives us a `.form` reference without contributing to `FormData`. This matches native `<input>` behavior: a control without a `name` is invisible to form serialization, even if the element exists in the DOM.

Reset listening is wired through a `$effect` driven by `bind:this` on that same hidden input. The effect runs once on mount, attaches the `reset` listener to the input's associated form, and cleans up on unmount. Moving the component across forms at runtime is not supported in v1 — there is no `MutationObserver` watching the input's `form` property — but the listener cleanup guarantees no zombie reset handlers fire after unmount.

On reset, uncontrolled fields revert to `defaultValue` (parsed and seeded into all three internal slots, with the original alpha preserved so a later `alpha={true}` toggle reconstructs `#rrggbbaa`). Reset never fires `onchange` — the parent observes resets through the native form `reset` event, not through ColorField's value callback. Controlled fields do nothing internally on reset; the parent's reset handler updates `value` and the effect reconciles.

## Reduced motion and forced colors

The component has no animated transitions in v1, so `prefers-reduced-motion` is a no-op. If we later animate the swatch (for example, a brief flash on commit), the animation must be gated on `@media (prefers-reduced-motion: no-preference)`.

In Windows High Contrast / forced-colors mode the swatch still renders as a small colored square, but the inner input's focus and error styling falls back to the system palette via the underlying `Input` and `FormField` rules — none of those rules are overridden here.

## Pairing recommendation

For production forms where users need to choose a color, pair the field with `color-picker.svelte`. The picker is the discovery surface; the field is the precision surface. Wire them to the same controlled `value` and they stay in sync.
