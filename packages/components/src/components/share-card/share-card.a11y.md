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

### Action buttons

The copy and native-share actions render as icon-only buttons by default (matching the `.dx-import__copy` pattern used elsewhere in this codebase for the same "copy a value" affordance), and ride along as the value field's `Input` `trailing` addon (`trailingInteractive`, so the buttons stay in the accessibility tree instead of being hidden under the field's own accessible name). Each button's accessible name comes from `aria-label`, driven by `ShareCardAction.label` — the required string accessible name — and that name does not change when a copy/share succeeds; only the live-region announcement and a `data-cinder-copied` styling hook change. When a consumer supplies `ShareCardAction.labelSnippet`, its rich content still renders visibly next to the icon, per the ratified contract that `label` is always the accessible name and `labelSnippet` is optional rich visible content, never a replacement for it.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ShareCard accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ShareCard in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `copy-button`, `card`, `button`.
