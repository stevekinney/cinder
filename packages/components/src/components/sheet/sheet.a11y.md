# Sheet — Accessibility Notes

See also: [`_internal/OVERLAY-POLICY.md`](../_internal/OVERLAY-POLICY.md)

## Role and ARIA attributes

The `<dialog>` element carries an implicit `role="dialog"`. Sheet sets `aria-modal="true"` explicitly because some screen readers do not infer modality from `showModal()` alone.

`aria-labelledby` is always set on the dialog. Which element it points to depends on the `header` and `ariaLabelledBy` props:

| Props supplied                        | `aria-labelledby` points to                                           |
| ------------------------------------- | --------------------------------------------------------------------- |
| Neither `header` nor `ariaLabelledBy` | The `<h2>` rendered inside the default header                         |
| `header` only                         | A visually-hidden `<h2 class="cinder-sr-only">` rendered by the sheet |
| `header` + `ariaLabelledBy="some-id"` | The consumer-supplied id                                              |

**Consumer guideline**: If your custom `header` snippet renders its own visible heading, pass `ariaLabelledBy` pointing to that heading's `id`. This ensures the accessible name matches what sighted users see and prevents a hidden duplicate being announced.

## Keyboard interactions

| Key                             | Action                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| `Tab`                           | Move focus forward through interactive elements inside the sheet |
| `Shift+Tab`                     | Move focus backward                                              |
| `Escape`                        | Close the sheet                                                  |
| Close button click / activation | Close the sheet                                                  |

The native `<dialog showModal()>` provides the focus trap; Sheet does not implement its own Tab cycling.

## Focus management

- **Capture on open**: `captureFocus()` records the element that held focus before the sheet opened.
- **Initial focus on open**: Focus is moved to the body container (`tabindex="-1"`, outline suppressed for programmatic focus) unless a child element carries `[autofocus]`. This avoids landing initial focus on the close button and gives screen-reader users a contextually appropriate starting point.
- **Restore on close**: All close paths (close button, backdrop click, ESC, programmatic `open = false`, component unmount) restore focus to the element identified by `triggerRef` if provided, otherwise to the captured focus element.
- **`triggerRef` precedence**: When both `triggerRef` and a captured focus element are available, `triggerRef` always wins. This precedence holds on unmount-while-open as well.

## Scroll lock

Body scroll is locked via the counted `lockBodyScroll()` helper from `overlay.ts`. The count is shared across all Cinder overlays, so a modal opened on top of an open sheet does not prematurely restore scroll when only the modal closes.

Scroll lock is released on every close path, including component unmount while open.

## Backdrop click

The `<dialog>` element fills the viewport (not the panel itself), so any pointer event outside the visible panel reliably lands on the dialog element. Sheet checks `event.target === dialogElement` and closes when true.

## Touch targets

The close button and the drag handle both meet the WCAG 2.5.5 minimum 44×44 CSS pixel target size at every breakpoint. The close button is sized 2.75rem × 2.75rem; the drag handle container has `min-height: 2.75rem` and spans the full panel width, even though the visible pill inside it is smaller for visual restraint.

## Drag handle

When `showDragHandle={true}`, a decorative drag handle renders above the header. The handle is marked `aria-hidden="true"` because it carries no semantic information beyond its visual affordance — the same close paths (close button, backdrop, ESC) remain the keyboard-accessible ways to dismiss the sheet.

The prop is named `showDragHandle` (not `draggable`) to avoid colliding with the native HTML `draggable` attribute on the underlying `<dialog>`.

Swipe-to-close gesture support is a stretch goal not implemented in the MVP. The `showDragHandle` prop currently only controls visibility of the handle, and the cursor is intentionally `default` rather than `grab` so pointer users are not given a false affordance. When swipe support lands, both will change in lockstep.

## Exit animation

The sheet now animates on both entry and exit. On close, the panel remains mounted with a transient closing state until its exit transition completes, and the native dialog backdrop fades during that same window before `dialog.close()` tears the overlay down.

## Reduced motion

Open and close transitions are gated by `@media (prefers-reduced-motion: no-preference)`. Under `prefers-reduced-motion: reduce`, both the panel and native backdrop disable transitions and close immediately after the deterministic cleanup path runs.
