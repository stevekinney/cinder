# Focus Trap — Accessibility Rationale

## What this component is — and what it isn't

`focus-trap.svelte` is a **headless behavior primitive**, not a widget. It renders a plain `<div>` wrapper and attaches focus-management behavior to it; everything it does happens through DOM focus, `keydown` interception, and `tabindex` bookkeeping. It keeps Tab and Shift+Tab navigation cycling _within_ its container while active, and it restores focus to wherever focus was before the trap activated when the trap is released. It does not paint anything, expose a value, or model a UI control. Think of it as the focus-containment half of a dialog — the part you would otherwise hand-roll on every overlay.

## Why it has no `role` and no ARIA attributes

A focus trap describes _behavior_, not _semantics_. The container has no inherent meaning to assistive technology: it is not a `dialog`, a `menu`, a `listbox`, or any other named pattern. The meaning lives on the thing the consumer wraps. Putting `role="dialog"` (or any role) on the trap itself would be a lie — the trap has no idea what it contains, and a screen reader announcing a generic "dialog" around an arbitrary region is worse than silence.

So the trap stays semantically transparent. It spreads any consumer-supplied attributes (`{...rest}`) straight onto its `<div>`, which means **the consumer owns the ARIA**. A modal that uses this primitive is responsible for `role="dialog"`, `aria-modal="true"`, and an accessible name (`aria-labelledby` / `aria-label`); the trap just guarantees keyboard focus cannot escape that modal while it is open. Keeping the two concerns separate is the point: one component decides what a region _means_, this one decides where focus is _allowed to go_.

## How focus enters the trap

On activation the trap moves focus inward using a deterministic fallback chain, because landing somewhere predictable is what lets keyboard and screen-reader users orient immediately:

1. The `initialFocus` target, if it resolves to an element that is actually focusable. A target that looks valid but cannot accept `.focus()` (a plain `<div>` with no `tabindex`) is verified by checking `document.activeElement` after the call and rejected if focus did not land — it does not silently swallow focus.
2. Otherwise, the first tabbable descendant, discovered by querying for focusable selectors and filtering out hidden, disabled, and `tabindex="-1"` elements.
3. Otherwise, the `fallbackFocus` target (which must carry an explicit `tabindex`, commonly `-1`, to accept programmatic focus without joining the Tab order).
4. As a last resort, the container itself — the trap temporarily sets `tabindex="-1"` on the root, focuses it, and removes that attribute again on teardown so the DOM is left exactly as it was found.

## How Tab and Shift+Tab cycle

While active, the trap listens for `Tab` on the container. It recomputes the tabbable set on every keypress (so dynamically added or removed controls are always respected), then wraps the edges: Tab on the last tabbable element moves focus to the first, and Shift+Tab on the first moves focus to the last. Interior Tab presses are left untouched — the browser's native sequential navigation handles them. Only the wrap points are intercepted with `preventDefault`, which keeps the experience identical to a native `<dialog>` for keyboard users.

## Restoring focus on release

When the trap deactivates — whether the `active` prop flips to `false` while still mounted, or the component unmounts entirely — focus returns to the element that was focused at activation time. Restoration is captured at activation and replayed at teardown, so it is correct even if `active` was already `false` by the time the component unmounts. The restore helper refuses to focus a disconnected or cross-document element and never falls back to `document.body`, so a user is never dumped at the top of the page with no focus context.

## Edge cases

- **No focusable children.** A Tab press in an empty trap is prevented and focus is routed to the `fallbackFocus` target, or to the container itself (made momentarily focusable). Focus cannot tab out into the page behind the overlay.
- **Nested traps.** Traps register on a shared stack, and only the top-most trap intercepts Tab. Opening a confirmation dialog on top of an existing modal works: the inner trap takes over, and when it closes the outer trap resumes control without either having to know about the other.
- **Reactive deactivation.** Because the keydown guard reads the live `active` getter, a trap toggled inactive stops intercepting Tab immediately rather than lingering until unmount — important so it does not block a lower trap on the stack.

## Consumer checklist

Wrap the trap around overlay content, then layer the semantics on the consumer side: set the appropriate `role` and accessible name on the wrapper or the element you pass through `{...rest}`, mark background content `inert` or `aria-hidden` while the overlay is open, and wire `Escape`-to-close in the consuming component — the trap deliberately handles only focus containment, not dismissal.
