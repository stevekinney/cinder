# Carousel accessibility notes

- Root uses `role="region"` and `aria-roledescription="carousel"` with an explicit accessible name.
- Slide picker buttons expose `aria-current="true"` on the active slide.
- Keyboard support: `ArrowLeft`, `ArrowRight`, `Home`, and `End` on the carousel region.
- Auto-advance pauses while hovered or focus is inside the carousel.
- Auto-advance is disabled when `prefers-reduced-motion: reduce` is active.
- A polite live region announces the active slide label and position.
