# Carousel accessibility notes

- Root uses `role="region"` and `aria-roledescription="carousel"` with an explicit accessible name.
- Slide picker buttons expose `aria-current="true"` on the active slide.
- Keyboard support: `ArrowLeft`, `ArrowRight`, `Home`, and `End` on the carousel region.
- Auto-advance pauses while hovered or focus is inside the carousel.
- Auto-advance is disabled when `prefers-reduced-motion: reduce` is active.
- A live region announces the active slide label and position; it is `polite` for user-driven navigation and switches to `off` while autoplay is advancing.

## Native scrolling review (#957)

The viewport (`role="group"`, labelled `"<label> slides"`) is a native horizontal
scroller with mandatory CSS scroll-snap, so touch swipe and trackpad/wheel
scroll both move the track without any custom gesture recognizer. There is no
pointermove-based drag recognizer, so an ordinary mouse click-drag does not
scroll the track — mouse users navigate via keyboard, the prev/next buttons,
or the dot picker. This review covers the resulting focus, keyboard, and
announcement behavior.

- **Focus management.** Arrow/Home/End keyboard navigation and pointer/touch
  scrolling share one focus rule: if focus is inside the slide being
  scrolled away from, focus moves to the viewport (`tabindex="0"`) before the
  index changes, so focus never gets silently orphaned inside a slide that is
  `inert`d out from under it (`transferFocusFromOutgoingSlide`). Keyboard
  navigation additionally refocuses the carousel region itself when the event
  originated inside the outgoing slide, keeping the roving `tabindex="0"` on
  the region consistent with the WAI-ARIA Carousel pattern. Native scroll
  input never traps or redirects focus that is outside the outgoing slide.
- **Keyboard matrix.** `ArrowLeft`/`ArrowRight` move one slide, `Home`/`End`
  jump to the first/last slide; the keydown handler on the carousel region
  calls `event.preventDefault()` on all four so the native scroller never
  double-handles arrow-key scrolling, and the handler fires regardless of
  which descendant has focus because `keydown` bubbles. Tab order is:
  carousel region → viewport (`tabindex="0"`) → the active slide's
  interactive content → prev/next buttons → dot picker. The viewport is a
  genuine, intentional stop — its own `tabindex="0"` lets a keyboard user
  land directly on the scrollable track and use Arrow/Home/End there without
  first tabbing into slide content, matching the existing "region owns
  navigation" carousel pattern.
- **Assistive-technology announcements.** The existing `polite` live region
  announcing `"Slide N of M: <label>"` is the single source of truth for
  index changes regardless of how the index changed (keyboard, dot click,
  touch swipe, wheel scroll, or native scroll settling). It is forced to `off` for the
  duration of any autoplay-driven transition so unattended auto-advance does
  not interrupt a screen reader; user-initiated scrolling (including a wheel
  gesture that cancels an in-flight autoplay/programmatic scroll) always
  restores `polite` before the next announcement. Only a horizontal wheel
  gesture (`deltaX`, or `deltaY` with Shift) is treated as carousel input;
  an incidental vertical wheel pass over the viewport does not cancel a
  pending programmatic or autoplay transition or otherwise affect
  announcements.
- **Reordering while resting.** If the `slides` array's identity order
  changes while the carousel isn't mid-interaction, the settled position is
  re-derived from the DOM (the slide nearest the viewport's leading edge)
  rather than trusting the previous numeric `settledIndex`, and any
  resulting realignment jumps immediately instead of animating. This keeps
  the previously-visible slide from being mislabeled outside the
  in-transition layout window and collapsed to zero height.
- **Unrelated window blur.** Losing window focus while no pointer
  interaction is tracked (for example, focusing browser chrome while a dot
  or autoplay transition is animating) clears only pointer-tracking state.
  It does not cancel a pending programmatic destination, so an intermediate
  scroll event from the still-running animation cannot be misread as native
  input and silently redirect the announced destination back to a
  mid-transition slide.
