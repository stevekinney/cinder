# SortableList Accessibility Notes

## Keyboard Interaction

| Key           | Phase  | Action                                                            |
| ------------- | ------ | ----------------------------------------------------------------- |
| Space / Enter | idle   | Lift the item whose handle is focused.                            |
| Space / Enter | lifted | Drop at the current target position.                              |
| Arrow Down    | lifted | Move to next position (clamped to last).                          |
| Arrow Up      | lifted | Move to previous position (clamped to first).                     |
| Home          | lifted | Move to first position.                                           |
| End           | lifted | Move to last position.                                            |
| Escape        | lifted | Cancel. Restores original visual order; onreorder is not called.  |
| Tab           | lifted | Cancel and allow native focus movement to next focusable element. |

Only the drag handle button is in the tab sequence. Row `<li>` elements have no `tabindex`.

## ARIA Model

- **List root**: `<ul role="list" aria-label={label}>`. Explicit `role="list"` because `list-style: none` can strip implicit semantics in some browser+AT combinations.
- **Each row**: `<li aria-roledescription="sortable item">`. The `aria-roledescription` gives screen reader users a hint without overriding the semantic role.
- **Drag handle**: `<button type="button" aria-label="Reorder {itemLabel}" aria-pressed={isLifted} aria-describedby={instructionsId}>`.
  - `aria-label` is per-item and consumer-supplied so multiple handles are distinguishable (e.g., "Reorder Buy milk").
  - `aria-pressed` reflects lifted state (false = idle, true = lifted).
  - `aria-describedby` points to a single hidden `<span>` with instructions rendered once inside the list.
- **Hidden instructions**: "Press Space to lift, then arrow keys to move, Space to drop, Escape to cancel."
- **Live region**: `<div aria-live="assertive" aria-atomic="true">` — assertive because the user just acted and is waiting for confirmation.

`aria-grabbed` and `aria-dropeffect` are **deprecated in ARIA 1.1** and intentionally not used.

## Announcement Strings

All four state transitions are announced via an `aria-live="assertive"` region:

| Transition | Message                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Lifted     | `{label}, lifted. Current position {n} of {total}. Use arrow keys to move. Space to drop, Escape to cancel.` |
| Moved      | `{label}, moved to position {n} of {total}.`                                                                 |
| Dropped    | `{label}, dropped at position {n} of {total}.`                                                               |
| Cancelled  | `Reorder cancelled. {label} returned to original position.`                                                  |

`{label}` is the raw `itemLabel` (e.g., "Buy milk"), not the handle label ("Reorder Buy milk"). Announcement strings are fully overridable via the `announcements` prop.

`moved` fires only when the target position actually changes. `dropped` fires even when the item returns to its original position; `onreorder` does not fire in that case.

## Pointer / Touch Strategy

HTML5 Drag and Drop API is **not used**. iOS Safari does not fire touch events on HTML5 drag targets, making it incompatible with touch devices.

Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) with `setPointerCapture` are used instead. This handles mouse, touch, and stylus uniformly. The drag handle has `touch-action: none` so the browser does not steal vertical pans.

## Drag Preview

During a pointer drag a fixed-position overlay (`.cinder-sortable-drag-preview`) is appended to `document.body`. The overlay clones the lifted row's HTML so the user can see what they are dragging as the pointer moves. The preview:

- Has `aria-hidden="true"` — it is purely visual and does not duplicate AT content.
- Has `pointer-events: none` — it does not interfere with drop-target hit testing.
- Is removed on drop, cancel, `pointercancel`, Escape (both handle-level and window-level), and component destroy.

The source row switches from `.cinder-sortable-item--lifted` to `.cinder-sortable-item--placeholder` during a pointer drag. The placeholder uses a dashed border and reduced opacity to mark the current drop target position without showing full card content.

Keyboard lifts use `.cinder-sortable-item--lifted` (no preview overlay — the item moves in-place).

## Focus Retention

Svelte's keyed `each` block preserves the focused DOM node across visual reorders. Focus stays on the handle of the lifted item as Arrow Up/Down moves it through the list.

Cancellation on bare `focusout` is intentionally not implemented — DOM reordering of keyed blocks produces transient blur/focus events that would make keyboard reorder unreliable.

## Auto-Scroll

Window-only vertical auto-scroll is implemented. When the pointer is within 32px of the viewport top or bottom during a drag, the page scrolls at 8px/frame and the insertion target is recomputed after each frame.

**Known auto-scroll limitations:**

- **Nested scroll containers**: Items inside a scrollable container (other than the window) will not auto-scroll during a pointer drag. Auto-scroll only applies to `window.scrollBy`.
- **Horizontal scroll**: The auto-scroll loop checks only the vertical edges of the viewport. Horizontal scroll (e.g. scrolling the KanbanBoard's columns container to reveal off-screen columns during a drag) is not implemented. Dragging a card toward the right/left edge of a KanbanBoard that overflows horizontally will not auto-scroll the board container.

## Reduced Motion

The shift-preview transition (`transform 150ms ease`) is disabled via:

```css
@media (prefers-reduced-motion: reduce) {
  .cinder-sortable-item--shifting {
    transition: none;
  }
}
```

The lift shadow (`box-shadow`) is preserved under reduced motion as it provides a non-animated positional cue.

## Known Limitations

- **Multi-select drag**: Out of scope. Each drag moves exactly one item.
- **Horizontal/grid sortable**: Out of scope. The controller is index-based; only vertical list order is supported.
- **Disabled items**: Out of scope.
- **Nested scroll containers**: Auto-scroll applies to the window only.
- **NVDA on Windows**: Verified with VoiceOver on macOS. NVDA compatibility tracking is deferred.
