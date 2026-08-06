---
'@lostgradient/cinder': minor
---

Carousel: adopt native `scrollend` for settle detection, add a `slide` snippet for custom slide content, make nearest-slide detection scroll-padding-aware, and move `activeIndex`/announcement writeback to settle-only for touch/wheel gestures.

- Settle detection (the moment a touch/wheel gesture is considered "done") now uses the native `scrollend` event where supported, falling back to the existing debounce timer where it isn't (Tier 2, `PLATFORM-POLICY.md`).
- **Behavior change:** during a touch/wheel gesture, `activeIndex`, `onSlideChange`, and the live-region announcement now update once, at settle — not on every intermediate scroll frame. A fast swipe through several slides no longer fires a rapid sequence of live-region announcements. Keyboard, button, and dot-picker navigation are unaffected (unchanged, synchronous). A cosmetic `visualIndex` still tracks the nearest slide every frame so the dot picker visually follows the drag.
- New `slide?: Snippet<[TSlide, { index, active }]>` prop (with `CarouselProps<TSlide extends CarouselSlide = CarouselSlide>` now generic) renders custom content inside each slide's `<article>`, replacing the built-in image/title/description/link body. `slides` remains the identity and accessible-labeling source of truth; `inert`/`aria-hidden`/`role`/`aria-label` are still owned by the component regardless of which body renders.
- `nearestVisibleSlideIndex` now reads `scroll-padding-inline-start` off the viewport (LTR) so a consumer-set snap inset is respected, instead of always comparing against the border-box edge.
- Internal: six separately-coordinated flags collapsed into one `CarouselMotion` state; replaced a hand-rolled ancestor `MutationObserver` for `dir` changes with the shared `observeTextDirection` utility.
