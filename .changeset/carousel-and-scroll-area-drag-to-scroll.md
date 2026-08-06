---
'@lostgradient/cinder': minor
---

Carousel and ScrollArea: fine-pointer (mouse) click-and-drag scrolling, with momentum and snap.

- Carousel now supports click-and-drag scrolling on a mouse automatically — no prop required. Dragging the track moves it with momentum-based physics and snaps to the nearest slide on release, matching the feel of a released touch swipe. Gated on `(hover: hover) and (pointer: fine)` and `!prefers-reduced-motion`; touch and pen are untouched (they already pan the native scroller directly).
- ScrollArea gets a new opt-in `dragToScroll?: boolean` prop (default `false`) for the same mouse drag-to-scroll behavior, along the scroll area's own `direction`. Not supported when `direction="both"` (logs a dev warning). Keyboard scrolling is unaffected either way.
- New shared utilities: `useDragScroll` (a `(node) => cleanup` attachment, in the house style of `useResizeObserver`) and `useFinePointer` (a `MediaQuery`-backed `(hover: hover) and (pointer: fine)` hook, mirroring `useReducedMotion`). Both live in `packages/components/src/utilities/` alongside the pure physics (`damp`/`project`/`snapSelect`/`dragSnap`/`shouldSnap`) they're built on.
- A drag past a 10px threshold suppresses the click it releases into (so a dragged slide link or button doesn't also activate), scoped to the element the engine attached to — never a global click swallow.

⚠️ Like the `slidesPerView` behavior shipped earlier, this introduces a new interaction model and has not yet had a human accessibility review — see the "Fine-pointer drag-to-scroll review" sections in `carousel.a11y.md` and `scroll-area.a11y.md` for the self-review that informed this implementation.
