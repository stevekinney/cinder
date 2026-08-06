---
'@lostgradient/cinder': minor
---

Carousel: add `slidesPerView`, `gap`, and `align` for multi-slide-per-view and peek layouts.

- `slidesPerView?: number | 'auto'` (default `1`): shows more than one slide at once. A fraction like `1.2` peeks the next slide. `'auto'` lets each slide size itself via its own CSS. Above `1`, more than one slide is simultaneously interactive/non-`inert` (the active range is `[currentIndex, currentIndex + ceil(slidesPerView) - 1]`, clamped to the deck), and the live region announces `"Slides N–M of Total"` instead of a single labelled slide. At the default `1`, behavior is unchanged.
- `gap?: string`: a CSS length between slides. Only applied when `slidesPerView` is not `1`.
- `align?: 'start' | 'center'` (default `'start'`): snap alignment of the active slide(s) within the viewport.
- `slidesPerView` above `1` and `loop` are mutually exclusive: setting both logs a dev warning and `loop` is ignored (wrapping a multi-slide range across the physical-order rotation boundary would leave a partial-width gap).

⚠️ This introduces a new interaction model (more than one slide can be active at once) and has not yet had a human accessibility review — see the "Multi-slide-per-view review" section in `carousel.a11y.md` for the self-review that informed this implementation and the open questions flagged for that review.
