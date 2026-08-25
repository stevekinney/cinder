# Color Field — Accessibility Rationale

## What this component is — and what it isn't

`color-field.svelte` is the **precision** counterpart to `color-picker.svelte`. The picker exists to let users graze visually across a color space; the field exists to accept an exact color value via keyboard entry. Neither replaces the other, and most production forms benefit from offering both side-by-side.

The field itself is a thin composition: an inner `<input>` (delivered by `Input`) plus a parser/normalizer that runs on blur. Everything that makes the inner input accessible — `aria-invalid`, `aria-describedby`, label association, native `disabled` and `required` behavior — flows through `Input` and the `FormField` context. ColorField does not duplicate that wiring.

## Why validation happens on blur, not on every keystroke

A user typing `#ff8800` will pass through `#`, `#f`, `#ff`, `#ff8` — every intermediate state is unparseable. Surfacing an "invalid color" error after each keystroke would mean the form screams at the user for the entire duration of their intent. Blur-time validation lets the user finish typing before we decide whether to flag the value, which matches how `<input type="email">` and most real-world form controls behave.

The trade-off is that an invalid committed value is not surfaced until focus moves elsewhere. That trade is the right one for a free-form text field — keyboard users typically tab away from the input to confirm their choice, and assistive technology announces the error at the moment they leave the field.

## Error ownership

There are two kinds of errors a color field can have. The first is a **parse error** — the text doesn't form a valid hex, rgb(), hsl(), hwb(), or oklch() string among the formats the `formats` prop currently accepts. The second is a **semantic validation error** — the value parses, but the consumer rejects it ("must match brand palette"). These have different owners.

Parse errors are owned by `ColorField` itself. The component gives the inner `Input` the current parse error, and `Input` wires `aria-invalid="true"` on the native `<input>` and renders the message in a `<p aria-live="polite">` referenced by `aria-describedby`. Consumers never need to know about parse failures — the field surfaces them automatically.

Semantic errors are owned by the wrapping `FormField`. When a consumer passes `error="..."` to `FormField`, that error renders in the form-field error region and feeds the form-field context. `Input` is smart enough to allocate a distinct id for its own (parse) error when the two would collide, so both messages render. The "both ids in `aria-describedby`" guarantee depends on the wrapping `FormField` carrying the same `id` as the `ColorField` — that's how the form-field context plumbs through.

Beyond ARIA, parse errors also participate in HTML constraint validation. The component calls `setCustomValidity` on the visible `<input>` whenever the parse state changes, so native form validation can block submit attempts while a parse error is present.

## The picker trigger and swatch

The trailing surface is an accessible Button named `Choose a color`. Its visual
swatch remains a nested `<span aria-hidden="true">`, while the adjacent pipette
icon is also decorative. Activating the button opens a labeled Popover containing
ColorPicker. Popover moves focus into the picker, Escape and outside activation
dismiss it, and focus returns to the trigger. The trigger is disabled whenever
ColorField is disabled or read-only; an already-open ColorPicker receives that
same disabled state so pointer and keyboard commits cannot change the field.

The swatch color comes from `committedHex`, not visible uncommitted text. A user
can type `not-a-color`, and the swatch keeps the previous committed color (or its
empty treatment); arbitrary input is never painted into the CSS variable. Picker
pointer and keyboard adjustments keep the Popover open, while choosing an
explicit preset swatch commits and closes it. ColorPicker owns its slider roles,
keyboard matrix, and value announcements as documented in `color-picker.a11y.md`.

## Picker interaction review outcome

The composed interaction was reviewed against standalone ColorPicker and the
previous text-only ColorField. Standalone ColorPicker remains the neighbour for a
large visual discovery surface; ColorField remains justified as a compact form
control that combines exact text entry with optional visual selection. The review
accepted Button + Popover + ColorPicker composition with the focus, dismissal,
commit, disabled/read-only, and announcement behavior recorded above and covered
by component and browser tests.

## Enter key behavior — and why it's explicit

Pressing Enter inside a text input has a default behavior: submit the surrounding form. That's fine when the input's value is what the form needs, and not fine when the input has unprocessed state. ColorField has unprocessed state during typing: `visibleText` is what the user has typed, but `committedHex` (the value the form should submit, formatted in whichever syntax the `format` prop selects — hex by default, or modern CSS Color 4 `rgb()`/`hsl()`/`hwb()`/`oklch()` syntax for the others; the internal variable is still named `committedHex` for historical reasons even when its content isn't hex) only updates on blur or Enter.

To avoid the race where the form submits with a stale hidden mirror, ColorField intercepts Enter, calls `preventDefault` first, runs the commit pipeline synchronously, writes the committed value — in the configured `format`'s syntax — to the hidden mirror's DOM value directly (not through Svelte's effect queue), and then — if `enterBehavior` is `'commit-then-submit'` — calls `form.requestSubmit()`. The submitter selection picks the first non-disabled `[type=submit]` (or unmarked `<button>`) in document order, which matches native default-submitter behavior for the common case.

In dialogs and multi-field flows where Enter should commit but not submit, consumers pass `enterBehavior='commit-only'`. The pipeline still runs synchronously; the form just doesn't dispatch a submit event. Consumers can read the committed value (in the configured `format`) from the hidden mirror in their own submit handler if they want full control.

## Form participation and form reset

The component always renders a single sibling `<input type="hidden">` that serves two purposes. When `name` is set, that input carries the `name` attribute and mirrors the current committed value — in the configured `format`'s syntax — so it participates in native form submission. When `name` is not set, the same input still renders (without a `name`) and acts purely as the anchor for form association — it gives us a `.form` reference without contributing to `FormData`. This matches native `<input>` behavior: a control without a `name` is invisible to form serialization, even if the element exists in the DOM.

Reset listening is wired through a `$effect` driven by `bind:this` on that same hidden input. The effect runs once on mount, attaches the `reset` listener to the input's associated form, and cleans up on unmount. Moving the component across forms at runtime is not supported in v1 — there is no `MutationObserver` watching the input's `form` property — but the listener cleanup guarantees no zombie reset handlers fire after unmount.

On reset, uncontrolled fields revert to `value` (parsed and seeded into all three internal slots, with the original alpha preserved so a later `alpha={true}` toggle reconstructs the alpha-bearing form of the configured `format` — `#rrggbbaa` for the `'hex'` default, or the equivalent slash-alpha syntax for the others). The reset target is the successfully-PARSED color snapshotted once at mount, not a re-validation of the raw initial string against whatever `formats`/`format` gate is current at reset time — a later `format` change can narrow the accepted-input set enough that the mount-time string would no longer pass it, even though the color itself was already accepted and committed; reset restores that color anyway, re-emitted through the current `format`. Reset never fires `onValueChange` — the parent observes resets through the native form `reset` event, not through ColorField's value callback. Controlled fields do nothing internally on reset; the parent's reset handler updates `value` and the effect reconciles.

## Reduced motion and forced colors

The component has no animated transitions in v1, so `prefers-reduced-motion` is a no-op. If we later animate the swatch (for example, a brief flash on commit), the animation must be gated on `@media (prefers-reduced-motion: no-preference)`.

In Windows High Contrast / forced-colors mode the swatch still renders as a small colored square, but the inner input's focus and error styling falls back to the system palette via the underlying `Input` and `FormField` rules — none of those rules are overridden here.

## Pairing recommendation

For forms that need a permanently visible discovery surface, use standalone
`color-picker.svelte` alongside or instead of ColorField. The field's own trailing
trigger already provides a compact picker for ordinary precision-entry forms.
