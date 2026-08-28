# ShareCard · accessibility

## Pattern

ShareCard exposes an operable control surface. Prefer the native interactive element it renders, keep the accessible name specific to the action, and do not replace it with a non-interactive wrapper.

Purpose: Compact share card with copy-link, copy-text, and native navigator.share actions, with accessible success announcements and graceful fallback when navigator.share is unavailable.

## Use when

- Offering a quick way to share a link or text with copy and native share options.
- Presenting a result, invite link, or exported report link with sharing affordances.

## Avoid when

- Generating the share text or images — compose ShareCard with your own copy generation logic.
- Posting directly to social media or analytics — wire those externally.

## Keyboard and focus

Activation should work with the native Enter and Space behavior of the rendered control. Custom children must not swallow those events unless they replace the whole interaction intentionally.

Keep focus indicators visible. If you wrap or restyle ShareCard, verify the focused element remains visually apparent in default and forced-colors modes.

### The value field

The shared value renders by composing the canonical `Input` primitive (`variant="code"`, `readonly`), not a raw `<input>` and not a non-interactive `<div>`. Reusing `Input` means the field gets the same read-only, focusable, monospace-well semantics as every other code/URI-like field in this library, instead of a bespoke re-implementation. This makes it reachable with `Tab` like any other field, and its `readonly` state means assistive technology announces it as a read-only text field rather than an editable one. Focusing the field selects its full contents, so a keyboard user can copy the value with `Tab` followed by `Ctrl`/`Cmd`-`C` without ever touching a pointer. The field's accessible name comes from `aria-label` ("Link to share" or "Text to share", chosen automatically based on whether the value looks like a URL); its accessible value is the input's own `value`, so no separate visible label element is needed.

A genuine `<input>` (via `Input`) was chosen over a `role="textbox"` wrapper because it gets correct read-only semantics, built-in text selection, and focus/select behavior from the platform for free, instead of re-implementing that contract by hand.

`value` is expected to be single-line — see `ShareCardProps.value`'s doc comment. A single-line `<input>` collapses `\n`/`\r` out of what it DISPLAYS, but ShareCard intercepts the field's own `copy` event (`handleFieldCopy`) so a manual select-and-copy on the field always sends the exact, unmodified `value` regardless — matching what every copy/share action button already sends (they read `value`/`copyValue` from component state, never from the DOM). A multi-line `value` also logs a dev-only console warning so the display limitation isn't silently missed in review.

The field is a read-only DISPLAY of `value`, not editable form state, so it must survive an ambient `<form>`'s native reset unchanged (an unrelated "Reset filters" button elsewhere on the page must not silently revert it to whatever was rendered at mount). ShareCard uses `Input`'s `inputAttachment` escape hatch to reach the real `<input>` node, find its owning `<form>` (if any) via `element.form`, which covers both a nested form and one the input is associated with by `form="<id>"`, and re-assert the current `value` prop back onto it on every native `reset` event — the same `form.addEventListener('reset', …)` pattern `color-picker.svelte` already uses for the same class of problem.

### Action buttons

The copy and native-share actions render as icon-only buttons by default (matching the `.dx-import__copy` pattern used elsewhere in this codebase for the same "copy a value" affordance). When every action uses that icon-only default, they ride along as the value field's `Input` `trailing` addon (`trailingInteractive`, so the buttons stay in the accessibility tree instead of being hidden under the field's own accessible name) for a compact, merged look. When a consumer supplies `ShareCardAction.labelSnippet` on any action, its rich visible content needs more room than `Input`'s trailing slot allows (that slot caps at `max-inline-size: 40%` of the field), so the whole actions row renders OUTSIDE the field instead, as a normal full-width group — never clipped or squeezed into the icon-only slot.

Each button's accessible name comes from `aria-label`, driven by `ShareCardAction.label` — the required string accessible name — and that name stays STABLE; it does not change when a copy/share succeeds. Only the live-region announcement (`VisuallyHiddenLiveRegion`) and a `data-cinder-copied` styling hook change on success. This is deliberate, not an oversight: a transient state announced by swapping a focused control's accessible name risks a redundant second announcement on top of the live region's (some screen readers re-announce a name change on the currently-focused element), and it makes the button unfindable-by-name mid-interaction. It matches `copy-button.svelte`'s and `secret-value-field.svelte`'s canonical model — the live region is the single source of truth for transient-success announcements. When a consumer supplies `ShareCardAction.labelSnippet`, its rich content still renders visibly next to the icon (and swaps to the literal `copiedLabel` text during the copied state, same as before), per the ratified contract that `label` is always the accessible name and `labelSnippet` is optional rich visible content, never a replacement for it.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ShareCard accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ShareCard in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `copy-button`, `card`, `button`.
