# Popover Accessibility

The popover is the generic interactive floating-panel primitive. It hosts arbitrary interactive content — pickers, profile cards, contextual forms, lightweight confirmations. It is distinct from `tooltip.svelte` (read-only hint, no focus trap) and `dropdown.svelte` (menu pattern).

## Role and semantics

The popover surface carries one of three roles, picked via the `role` prop:

- **`dialog`** (default): a non-modal dialog. No `aria-modal`, no scroll lock, no focus trap. Matches the WAI-ARIA APG _non-modal dialog_ pattern. Pass a meaningful `label` or `ariaLabelledby` so assistive technologies can announce the dialog by name.
- **`group`**: a labelled cluster of related controls. Use when the popover is a logical grouping rather than a dialog or list.
- **`listbox`**: only sets the panel role. **The consumer is responsible** for rendering `role="option"` children, managing `aria-activedescendant` or roving tabindex, and owning arrow-key navigation. The popover provides the surface only. A one-time dev warning fires when `role="listbox"` is selected.

## Accessible name

Precedence: `ariaLabelledby` > `label` > the literal `'Popover'`. Exactly one of `aria-labelledby` or `aria-label` is rendered on the panel. When `role="dialog"` and neither `label` nor `ariaLabelledby` is supplied, the panel falls back to `aria-label="Popover"` and a one-time dev warning fires per instance.

## Keyboard

| Key    | Behaviour                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escape | Closes the popover and restores focus. Handled in the capture phase via the shared overlay escape stack — child handlers cannot prevent it.                   |
| Tab    | Moves through focusable elements inside the panel. **Tab may leave the panel without closing it.** This is intentional — non-modal dialogs do not trap focus. |

## Focus contract

On open:

1. `captureFocus()` snapshots the currently-focused element.
2. The component waits for floating-ui's first `computePosition` to resolve (`positionReady=true`). Until then the panel is `visibility: hidden` and focus does not move — focus never lands in invisible content.
3. Once positioning is ready, focus moves to the first focusable element inside the panel. If no focusable child exists, focus lands on the panel root (`tabindex="-1"`).

On close, the component restores focus in this order:

1. `triggerRef` if provided and still connected.
2. The resolved anchor at open time, if still connected.
3. The captured-focus element, if still connected.
4. Otherwise no restore.

## Trigger contract

Consumers toggle `open` on the trigger's `click`. The popover does not intercept the trigger event. The `triggerRef` prop wins over the `trigger` snippet's resolved focusable for all four trigger-derived behaviours: ARIA wiring, floating-ui positioning, outside-mousedown exclusion, and focus restore on close.

The trigger receives:

- `aria-expanded` continuously, mirroring `open`. Screen readers can announce expanded/collapsed state even before the user opens the popover once.
- `aria-haspopup` continuously, with a role-mapped value: `'dialog'` (default), `'listbox'`, or absent for `'group'`.
- `aria-controls={panelId}` only while `open=true`. The attribute would otherwise reference a panel that is not in the DOM. Pre-existing values are captured and restored when the component unmounts.

## Outside interaction

A `mousedown` outside the panel and outside the resolved anchor closes the popover. `mousedown` is used rather than `click` so the close fires on the press, before any click handler runs. Multi-popover note: each popover's outside-mousedown handler only knows about its own panel and anchor, so opening popover B while popover A is open closes A on the mousedown inside B. Intentional, matches `dropdown.svelte`.

## Limitations

- Capture-phase Escape and outside-mousedown are uncancellable from child content. Consumers needing different semantics use a different primitive.
- iOS Safari `mousedown` has a ~300ms tap delay before any subsequent `click`. This is a platform tradeoff of the spec'd `mousedown`-first close behaviour.

## Distinction table

| Component | Role                 | Focus management            | Anchor positioning | Dismissal                                  |
| --------- | -------------------- | --------------------------- | ------------------ | ------------------------------------------ |
| Popover   | dialog/group/listbox | non-modal capture + restore | floating-ui        | Escape, outside mousedown                  |
| Tooltip   | tooltip              | none                        | floating-ui        | mouseleave, blur                           |
| Dropdown  | menu                 | menu-style roving           | floating-ui        | Escape, outside mousedown, item activation |
| Modal     | dialog (modal)       | focus trap                  | viewport-centered  | Escape (native cancel), backdrop, close-X  |

## Manual QA checklist

Run from `packages/playground/` with `bun run dev` and exercise the popover example in Chrome and Safari:

- Anchor visibility: popover renders at `bottom-start` by default.
- Flip on scroll: scroll the page until the trigger nears the viewport bottom; the popover should flip to `top-start`.
- ESC restores focus to the trigger.
- Outside-mousedown closes; mousedown on the trigger does not close (clicks toggle through the trigger's own handler).
- `prefers-reduced-motion` suppresses the opacity transition.
- Screen reader announces the role and accessible name when the popover opens.

## Progressive enhancement

CSS Anchor Positioning is the future-stable replacement for the JS-driven `@floating-ui/dom` positioning used today. The swap is internal — public props and the focus contract do not change.

## What `bun test` cannot verify

happy-dom does not implement real layout, so the test suite cannot exercise:

- Actual placement geometry.
- Flip/shift behaviour on real scroll/resize.
- Focus order across nested overlays in a real engine.
- `prefers-reduced-motion` end-to-end.

These belong in the manual QA checklist above.
