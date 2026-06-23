# Click-Away Listener — Accessibility Rationale

## What this component is — and what it isn't

`click-away-listener.svelte` is a **headless behavior primitive**, not a widget. It renders a plain `<div>` wrapper and attaches a pointer listener to `document`; everything it does happens through a single `pointerdown` (or `mousedown`/`touchstart`) event. It has no visual representation, no keyboard behavior, no focus management, and no ARIA semantics. It does exactly one thing: call `onclickaway` when the user presses a pointer device outside the wrapped subtree.

## Why it has no `role` and no ARIA attributes

This component describes a pointer-dismissal _behavior_, not a UI _widget_. There is no ARIA role that corresponds to "a region that closes when you click outside it." Adding a generic `role` would be misleading — a screen reader announcing an unnamed "region" around arbitrary content is unhelpful at best and confusing at worst.

The component spreads any consumer-supplied attributes (`{...rest}`) straight onto its `<div>`, so the **consumer owns the semantics**. A popover that uses this primitive is responsible for `role="dialog"` (or none), an accessible name, and whatever ARIA state reflects the open/closed condition. This component contributes nothing to that story and tries not to interfere.

## The keyboard gap — and what consumers must do

This component responds only to pointer events (`pointerdown`, `mousedown`, `touchstart`). It provides **no keyboard dismissal**. Keyboard users — including screen reader users who navigate without a pointer — have no way to trigger the `onclickaway` callback.

This is an intentional scope boundary, not an oversight, but it means consumers carry a hard responsibility:

- **Wire `Escape` to close.** Any overlay or flyout using `ClickAwayListener` for outside-click dismissal must also listen for `Escape` on the container or on `document` and call the same close callback. Without this, a keyboard user who opens the overlay has no standard way to dismiss it.
- **Manage focus.** When an overlay opens, focus must move into it. When it closes (for any reason — pointer, `Escape`, programmatic), focus must return to the trigger or some other meaningful point. This component does none of that. Use `FocusTrap` alongside `ClickAwayListener` when the overlay is a modal or otherwise focus-containing UI.
- **Mark background content `inert`** (or `aria-hidden`) while the overlay is open if focus and pointer interaction should be contained. `ClickAwayListener` does not suppress or re-route pointer events — clicking outside calls `onclickaway` and the event propagates normally.

## Cross-references

- `focus-trap` — handles Tab containment and focus restoration. Pair it with `ClickAwayListener` when building a modal or popover that also needs pointer dismissal.
- `Popover` — a composed overlay that handles both pointer dismissal and focus management internally. Use `Popover` instead of `ClickAwayListener` directly when you want those concerns pre-wired.
- `Dropdown` — another composed pattern with built-in outside-click handling.

## Consumer checklist

- Provide `Escape`-to-close alongside `onclickaway`.
- Move focus into the overlay on open and restore it on close.
- Set `inert` or `aria-hidden` on background content when the overlay is modal.
- Add the appropriate `role`, `aria-modal`, `aria-label`/`aria-labelledby` on the overlay element, not on the `ClickAwayListener` wrapper.
