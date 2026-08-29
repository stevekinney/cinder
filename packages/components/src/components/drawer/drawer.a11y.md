# Drawer — Accessibility Notes

See also: [`_internal/OVERLAY-POLICY.md`](../_internal/OVERLAY-POLICY.md)

## Role and ARIA attributes

The `<dialog>` element carries an implicit `role="dialog"`. Drawer sets `aria-modal="true"` explicitly because some screen readers do not infer modality from `showModal()` alone.

When `modal={false}`, Drawer renders an `<aside>` instead of a native dialog. The non-modal drawer omits `aria-modal`, does not lock body scroll, does not render a backdrop, and does not attach the focus trap. It still registers with the shared Escape stack while open so Escape ordering remains deterministic with other overlays.

`aria-labelledby` is always set on the dialog. Which element it points to depends on the `header` and `ariaLabelledby` props:

| Props supplied                        | `aria-labelledby` points to                                            |
| ------------------------------------- | ---------------------------------------------------------------------- |
| Neither `header` nor `ariaLabelledby` | The `<h2>` rendered inside the default header                          |
| `header` only                         | A visually-hidden `<h2 class="cinder-sr-only">` rendered by the drawer |
| `header` + `ariaLabelledby="some-id"` | The consumer-supplied id                                               |

**Consumer guideline**: If your custom `header` snippet renders its own visible heading, pass `ariaLabelledby` pointing to that heading's `id`. This ensures the accessible name matches what sighted users see and prevents a hidden duplicate being announced.

## Keyboard interactions

| Key                             | Action                                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| `Tab`                           | Move focus forward through interactive elements inside the drawer |
| `Shift+Tab`                     | Move focus backward                                               |
| `Escape`                        | Close the drawer                                                  |
| Close button click / activation | Close the drawer                                                  |

The native `<dialog showModal()>` plus the shared focus-trap attachment provide Tab containment for modal drawers. Non-modal drawers do not trap Tab, so focus can move between the drawer and the page.

## Focus management

- **Capture on open**: `captureFocus()` records the element that held focus before the drawer opened.
- **Initial focus on open**: Focus is moved to the body container (`tabindex="-1"`, outline suppressed for programmatic focus) unless a child element carries `[autofocus]`. This avoids landing initial focus on the close button and gives screen-reader users a contextually appropriate starting point.
- **Restore on close**: All close paths (close button, backdrop click, ESC, programmatic `open = false`, component unmount) restore focus to the element identified by `triggerRef` if provided, otherwise to the captured focus element.
- **`triggerRef` precedence**: When both `triggerRef` and a captured focus element are available, `triggerRef` always wins. This precedence holds on unmount-while-open as well.

## Scroll lock

Modal drawer body scroll is locked via the counted `lockBodyScroll()` helper from `overlay.ts`. The count is shared across all Cinder overlays, so a modal opened on top of an open drawer does not prematurely restore scroll when only the modal closes. Non-modal drawers skip this lock.

Scroll lock is released on every close path, including component unmount while open.

## Backdrop click

The `<dialog>` element fills the viewport (not the panel itself), so any pointer event outside the visible panel reliably lands on the dialog element. Drawer checks `event.target === dialogElement` and closes when true.

## Touch targets

The close button and the drag handle both meet the WCAG 2.5.5 minimum 44×44 CSS pixel target size at every breakpoint. The close button is sized 2.75rem × 2.75rem; the drag handle container has `min-height` at the 44px touch-target token and spans the full panel width, even though the visible pill inside it is smaller for visual restraint.

## Drag handle (bottom placement)

When `dragHandleVisible={true}` and `placement="bottom"`, a decorative drag handle renders above the header. The handle is marked `aria-hidden="true"` because it carries no semantic information beyond its visual affordance — the same close paths (close button, backdrop, ESC) remain the keyboard-accessible ways to dismiss the drawer.

The prop is named `dragHandleVisible` (not `draggable`) to avoid colliding with the native HTML `draggable` attribute on the underlying `<dialog>`.

Swipe-to-close gesture support is a stretch goal not implemented in the MVP. The `dragHandleVisible` prop currently only controls visibility of the handle, and the cursor is intentionally `default` rather than `grab` so pointer users are not given a false affordance. When swipe support lands, both will change in lockstep.

## Reduced motion

Open and close transitions are gated by `@media (prefers-reduced-motion: no-preference)`. Under `prefers-reduced-motion: reduce`, both the panel and native backdrop disable transitions and close immediately after the deterministic cleanup path runs.

## SSR — drawer is a client-only overlay

Drawer renders empty markup during server-side rendering regardless of the `open` prop value. This is the [OVERLAY-POLICY](../_internal/OVERLAY-POLICY.md)-mandated contract for all Cinder overlays. An initially-open drawer paints one frame after client hydration.

If first-paint overlay content is required (e.g., a server-rendered page that should open a drawer immediately), render the panel content inline (outside the drawer) during SSR and migrate to the drawer component once hydrated.

## Native focus trap coverage

Drawer's unit tests assert event ordering and state transitions. They do not assert browser-level Tab cycling or screen-reader announcement behavior — those require a real browser and are verified manually in the playground. If the project adds Playwright browser tests in a future phase, drawer should be covered there.

## Stacked overlays

Drawer participates in the Cinder escape stack by pushing a no-op handler on open (presence marker for the stack). In v1, the escape stack does not prevent native `<dialog>` from closing when ESC is pressed while a non-dialog overlay is stacked on top. Closing both the popover and the drawer is the documented v1 behavior.

The `inert` attribute is not set on sibling content manually — native `showModal()` makes the rest of the document inert from the platform's perspective.
