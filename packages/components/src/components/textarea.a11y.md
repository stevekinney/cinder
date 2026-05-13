# Textarea Accessibility

## Semantic Structure

The Textarea component renders a `<div class="cinder-textarea-field">` wrapper containing a native `<label>`, a native `<textarea>`, and optional `<p>` elements for description and error text. Native HTML elements are used throughout so assistive technology receives correct role semantics without relying on ARIA role overrides.

## Label Association

When the `label` prop is provided, a `<label for={id}>` is rendered. The `for` attribute value matches the `id` prop passed to both the `<label>` and the `<textarea>`, creating a programmatic association that:

- Gives the textarea an accessible name announced by screen readers on focus.
- Expands the click target — clicking the label text moves focus to the textarea.
- Is required for WCAG 2.1 SC 1.3.1 (Info and Relationships) and SC 4.1.2 (Name, Role, Value).

The `id` prop is required on `TextareaProps` and intentionally has no default, enforcing uniqueness at the call site.

## Description (`aria-describedby`)

When the `description` prop is provided, a `<p id="{id}-description">` is rendered and the textarea receives `aria-describedby="{id}-description"`. Screen readers announce the description after the field label and role, giving users supplementary context (character limits, format hints) without obscuring the primary label.

## Error State

When the `error` prop is provided:

- `aria-invalid="true"` is set on the `<textarea>` so assistive technology announces the field as invalid upon focus.
- A `<p id="{id}-error" aria-live="polite">` renders the error message. The `aria-live="polite"` region announces the error without interrupting in-progress speech, so users who are already past the field still hear the error when their screen reader is ready.
- `aria-describedby` on the textarea includes `{id}-error`, so navigating back to the field also re-reads the error.

When both `description` and `error` are set, both IDs are space-separated in `aria-describedby` so neither is lost.

## Keyboard Interactions

| Key               | Behaviour                                             |
| ----------------- | ----------------------------------------------------- |
| Tab / Shift+Tab   | Moves focus into and out of the textarea.             |
| Any printable key | Appends to textarea content; `value` binding updates. |
| Enter             | Inserts a newline (default `<textarea>` behaviour).   |

No custom keyboard handling is added; the browser's native textarea behaviour is preserved in full.

## Focus Visibility

The textarea's `:focus-visible` style renders a `box-shadow` ring (2 px offset + ring width) using `--cinder-ring-color` (defaults to the accent colour). In Forced Colors Mode (Windows High Contrast, print), `box-shadow` is suppressed by the browser, so a `@media (forced-colors: active)` block substitutes a solid `outline` on `ButtonText` to maintain a visible focus indicator per WCAG 2.1 SC 2.4.7.

## Disabled State

Setting `disabled` on the component forwards the attribute to the native `<textarea>`, which:

- Removes the field from the tab order.
- Prevents user input.
- Is announced by screen readers as "dimmed" or "unavailable" (NVDA/JAWS/VoiceOver wording varies).

The CSS removes `resize: vertical` for disabled textareas to prevent a confusing resize handle on an uneditable field.

## Character Count

When `showCount` is true and `maxlength` is set to a valid non-negative integer, an `<output id="{id}-count" for="{id}" aria-live="polite" aria-atomic="true">` renders showing `{value.length}/{maxlength}`. The `<output>` element carries the implicit ARIA role `status` (a polite live region), and `aria-atomic="true"` ensures the full "42/500" text is announced rather than just the changed portion. The count element id is included in the textarea's `aria-describedby`, so:

- On focus, screen readers announce the current count as part of the field's description.
- During typing, the polite live region announces updates without interrupting the user.

Both wirings are intentional. The `aria-describedby` reference covers the focus-entry announcement; the live region covers updates while the field already has focus.

The count uses JavaScript string length (UTF-16 code units), matching the browser's own `maxlength` enforcement, so the displayed count never disagrees with the field's enforced limit.

**Reactivity contract.** The counter follows the component's local `value` state. User input updates the displayed count immediately; parent code should still use `bind:value` when it needs to observe or control the current value outside the component.

**`showCount` without `maxlength`.** If `showCount` is `true` but `maxlength` is absent or invalid, the counter is silently omitted—the prop is advisory, not a requirement.

## Auto-Resize

`.cinder-textarea` uses `field-sizing: content`, which lets the textarea grow vertically as content is added without JavaScript. The `rows` prop continues to influence the initial visible height, though under `field-sizing: content` the browser may collapse the box to fit short content (specifically, under one row of content the box uses content-derived sizing rather than `rows`). `min-height: 6rem` clamps the lower bound so the textarea is never smaller than that, and users can still drag to resize vertically.

**Browser support.** `field-sizing: content` is supported in Chromium 123+ and Safari 18.2+ at the time of writing. In Firefox the textarea falls back to fixed `rows` + manual `resize: vertical`, which remains accessible—content is never truncated; users scroll within the textarea.

**Screen-reader behavior with auto-resize.** Auto-resize does not affect the accessible tree—the textarea's role, name, and value are unchanged when the box grows. There is no announcement on resize, which is the correct behavior; resize is purely visual.

**JS height-sync fallback (deferred).** A JavaScript `ResizeObserver` + `scrollHeight` polyfill for Firefox is intentionally deferred. The fallback would mirror `field-sizing: content` by setting `style.height = scrollHeight + 'px'` on input. It is tracked as a separate follow-up because (a) the no-JS baseline is already accessible, and (b) Firefox is expected to ship `field-sizing` support.

## WCAG 2.1 Compliance Summary

| Success Criterion            | Level | Satisfied by                                                                                                                  |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1.3.1 Info and Relationships | A     | `<label for>` association                                                                                                     |
| 1.3.5 Identify Input Purpose | AA    | Native `<textarea>` with `autocomplete` passthrough via `...rest`                                                             |
| 2.4.7 Focus Visible          | AA    | `:focus-visible` ring; WHCM fallback outline                                                                                  |
| 3.3.1 Error Identification   | A     | `aria-invalid="true"` + visible error `<p>`                                                                                   |
| 3.3.2 Labels or Instructions | A     | Rendered `<label>` + optional description `<p>`                                                                               |
| 4.1.2 Name, Role, Value      | A     | Native `<textarea>` with programmatic label                                                                                   |
| 4.1.3 Status Messages        | AA    | Error `<p aria-live="polite">` as live region; count `<output aria-live="polite" aria-atomic="true">` when `showCount` is set |
