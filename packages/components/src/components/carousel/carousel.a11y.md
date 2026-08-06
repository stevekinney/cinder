# Carousel accessibility notes

- Root uses `role="region"` and `aria-roledescription="carousel"` with an explicit accessible name.
- Slide picker buttons expose `aria-current="true"` on the active slide.
- Keyboard support: `ArrowLeft`, `ArrowRight`, `Home`, and `End` on the carousel region.
- Auto-advance pauses while hovered or focus is inside the carousel.
- Auto-advance is disabled when `prefers-reduced-motion: reduce` is active.
- A live region announces the active slide label and position; it is `polite` for user-driven navigation and switches to `off` while autoplay is advancing.
- The announcement (and `activeIndex`/`onSlideChange`) fire once, at the end of a touch/wheel gesture, never per intermediate scroll frame — see "Settle-only writeback" below.

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
  interactive content → prev/next buttons → the autoplay pause/play toggle
  (only rendered when `autoplay` is on and reduced motion is off) → dot
  picker. The viewport is a genuine, intentional stop — its own
  `tabindex="0"` lets a keyboard user land directly on the scrollable track
  and use Arrow/Home/End there without first tabbing into slide content,
  matching the existing "region owns navigation" carousel pattern.
- **Assistive-technology announcements.** The existing `polite` live region
  announcing `"Slide N of M: <label>"` is the single source of truth for
  index changes regardless of how the index changed (keyboard, dot click,
  touch swipe, wheel scroll, or native scroll settling). It is forced to `off` for the
  duration of any autoplay-driven transition so unattended auto-advance does
  not interrupt a screen reader; user-initiated scrolling (including a wheel
  gesture that cancels an in-flight autoplay/programmatic scroll) always
  restores `polite` before the next announcement. Only a wheel gesture whose
  horizontal component dominates (`|deltaX| > |deltaY|`), or a Shift-modified
  vertical scroll, is treated as carousel input; an ordinary vertical wheel
  or trackpad pass — including one with a small incidental `deltaX` — does
  not cancel a pending programmatic or autoplay transition or otherwise
  affect announcements.
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
- **The `slide` snippet cannot bypass the a11y guarantees.** It renders
  _inside_ the existing `<article class="cinder-carousel__slide">` — the
  component still owns that element's `role="group"`,
  `aria-roledescription="slide"`, `aria-label`, `aria-hidden`, `inert`, and
  `style:order`. A consumer supplying custom slide content cannot omit or
  desync these; only the built-in image/title/description/link body is
  replaced. `slides` (and its `id`/`label` fields) remain the identity and
  accessible-labeling source of truth regardless of which body renders.
- **Settle-only writeback (#carousel-motion).** `activeIndex`, `onSlideChange`,
  and the live-region announcement update only once a touch/wheel gesture
  _settles_ (native `scrollend`, or the debounce fallback) — never on every
  intermediate scroll frame. A fast swipe through several slides no longer
  fires a rapid-fire sequence of live-region announcements a screen reader
  would otherwise try to read mid-gesture; only the final resting slide is
  announced. Keyboard, button, and dot-picker navigation are unaffected —
  those already wrote back and announced synchronously and still do. A
  cosmetic, non-bindable `visualIndex` still tracks the nearest slide on
  every frame during a gesture so the dot picker's `aria-current` visually
  follows the drag; it is not itself announced. `inert`/`aria-hidden` on the
  slide `<article>`s change together with `activeIndex`, at settle — a slide
  a screen reader user tabs into mid-swipe is not made inert until the
  gesture actually finishes.
- **Only a pointer that can pan starts an interaction, and only actual
  movement widens the layout.** `pointerdown` marks a trackable interaction
  (pausing autoplay, and clearing any pending programmatic destination) only
  for `touch` and `pen` pointers, since a mouse has no drag recognizer here.
  Separately, the in-transition layout window that keeps physical neighbors
  laid out only widens once the track is actually moving (a real scroll
  event, or a programmatic transition in flight) — not merely because a
  touch/pen pointer is held down. A tap on a link or button inside the
  active slide, from any pointer type, therefore can't momentarily pop a
  taller neighbor's height in and back out.

## Multi-slide-per-view review (`slidesPerView`, `align`)

> **Review status: AI-authored, not yet human-reviewed.** `slidesPerView`
> introduces a genuinely novel interaction model for this component — more
> than one slide can be simultaneously interactive — and per the component
> authoring checklist this needs a human accessibility review before this
> capability should be considered ready to ship. The analysis below is the
> best-effort self-review that informed the implementation; treat it as a
> starting point for that review, not a substitute for it.

**The core model.** `slidesPerView` (a number, e.g. `2` or a peek value like
`1.2`, or `'auto'`) widens the "active" state from a single slide to a
contiguous range: `[currentIndex, currentIndex + ceil(slidesPerView) - 1]`,
clamped to the deck. Every slide in that range gets the same
`aria-hidden`/`inert` treatment the single-slide case already gave the one
active slide; every slide outside it is `inert` exactly as before. At the
default `slidesPerView: 1`, the range is always exactly `[currentIndex,
currentIndex]` — this is arithmetically identical to the pre-existing
single-slide logic, which is what keeps every prior accessibility guarantee
(focus transfer, `inert` timing, live-region contract) intact unchanged for
every consumer who never sets this prop.

**Why the range rounds up, not down.** A fractional `slidesPerView` (the
peek pattern) makes a _partial_ slide visible — e.g. `1.2` shows 20% of the
next slide. That sliver is genuinely rendered and visible, so it is made
interactive/reachable rather than left inert-but-visible, which would be a
"visible but you can't get there without an extra swipe" trap for keyboard
and screen-reader users. This mirrors the general principle that visible
content should be reachable content. The consequence: at `slidesPerView:
2.5`, three slides (two full, one half) are all active/non-inert.

**Live-region wording changes shape with a range.** A single active slide
still announces `"Slide N of M: <label>"`. A range of more than one slide
announces `"Slides N–M of Total"` — the per-slide `label` is dropped because
there is no single accessible name for a set of dissimilar slides. This is
the one place multi-slide-per-view changes an announcement string shape;
every other announcement path (settle timing, autoplay suppression, `polite`
vs `off`) is unchanged.

**What was _not_ attempted, and why.** The active RANGE is derived from
`currentIndex` and the rounded-up `slidesPerView` count, not measured from
real DOM geometry (unlike `nearestVisibleSlideIndex`, which does read real
rects). A geometry-measured range would be more accurate for `'auto'` mode
or a viewport that doesn't evenly divide by `slidesPerView`, but it would
mean re-measuring every slide's rect on every render to decide `inert`,
which is a real perf and complexity cost for a v1. `'auto'` mode is
therefore scoped down to behave like a range of 1 (a single primary slide) —
documented, not silently wrong, but a real capability gap a human reviewer
should weigh against the added complexity of geometry-based ranging.

**Only one dot is `aria-current`, even with a range active.** The dot picker
still marks exactly one dot current (`currentIndex`/`visualIndex`), not the
whole active range. This matches the existing single-slide picker semantics
and avoids inventing new multi-current picker semantics without a design
review; a human reviewer may want a different treatment (e.g. marking the
whole range, or grouping the dots).

**`align: 'center'` reuses the existing geometry functions, not new ones.**
`nearestVisibleSlideIndex` and `scrollToActiveSlide` now compare/scroll to
slide _centers_ against the viewport's center when `align: 'center'`,
instead of slide/viewport left edges. This is the same code path
`slidesPerView: 1` already used (`align` is independent of `slidesPerView`),
so it inherits the existing RTL scoping decision: centered-RTL destinations
are not implemented (no consumer sets it yet, no test coverage to validate
against), matching the same scoping already documented for
`scroll-padding-inline-start` above.

**`slidesPerView` above 1 and `loop` are mutually exclusive in v1.** Setting
both emits a dev-only warning and `loop` is silently ignored (the carousel
clamps at the ends instead of wrapping). Wrapping a _range_ of slides across
the physical-order rotation boundary would leave a partial-width gap at the
wrap point — the same class of problem `loop`'s single-slide "seamless only
on the first cycle" caveat already describes, just with no correct answer to
fall back to for a multi-slide range. This is intentionally deferred rather
than half-implemented.

## Fine-pointer drag-to-scroll review (`useDragScroll`)

> **Review status: AI-authored, not yet human-reviewed.** Like the
> `slidesPerView` review above, this is a self-review that informed the
> implementation, not a substitute for the accessibility review the
> component authoring checklist calls for on a novel interaction.

**Mouse-only, additive.** The engine attaches only for `pointerType ===
'mouse'`, gated further on `(hover: hover) and (pointer: fine)` and
`!prefersReducedMotion`. Touch and pen are completely untouched — they
already pan the native CSS-snap scroller directly, as documented in the
"Native scrolling review" above, and this engine never attaches for them.
Keyboard navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`), the prev/next
buttons, and the dot picker are all unaffected; a mouse user who never
drags loses nothing.

**Why disabling under `prefers-reduced-motion` is the whole engine, not
just a duration tweak.** Momentum (coasting after release) and the snap
settle are inertial motion by definition — there's no "instant" variant of
"the track keeps moving after your hand stops." Rather than build a second,
non-inertial drag mode, this preference disables the engine outright;
native scrolling with CSS snap (unaffected by this preference) remains
fully usable via click-through to the prev/next buttons, keyboard, or the
dot picker.

**`scroll-snap-type` is only overridden while a drag is actually
happening, not persistently.** The engine reads and stashes the current
`scroll-snap-type` on `pointerdown` and sets it to `none` immediately —
before knowing whether the gesture will cross the drag threshold — so the
track can start moving the instant a real drag is recognized, with no
one-frame native-snap fight at the start. It restores the original value
the moment the gesture ends, whether that "end" is settling from momentum
after a real drag or an immediate restore for a `pointerdown`→`pointerup`
that never crossed the threshold (an ordinary click). Keyboard, wheel, and
touch users always see native `scroll-snap-type: x mandatory` — the
override is invisible to every input method except an active mouse drag.

**Click suppression is scoped to the node the engine attached to, not
global.** Blossom's `preventGlobalClick` swallows the next click anywhere
in the document; this implementation sets `data-cinder-dragged` on the
viewport itself, and a `click` listener in the capture phase on that same
node checks the attribute before deciding whether to suppress. A drag that
ends over the carousel's own slide link or a control button is suppressed;
nothing outside the carousel viewport is ever affected. The attribute
clears on the next macrotask after release, which happens to also be after
the browser's own synthesized `click` for that release — the ordering this
depends on is a real-browser event-loop guarantee that `use-drag-scroll.svelte.test.ts`
cannot exercise in happy-dom, hence the dedicated Playwright coverage.

**`user-select: none` is scoped to `[data-cinder-dragging] *` inside the
carousel viewport, not applied globally or persistently.** Ordinary text
selection inside slide copy is unaffected outside an active drag.

**Snap-position selection uses index-position geometry
(`slide.offsetLeft`), independent of the active-range model above.** A
released drag always snaps to the nearest individual slide's edge (or
center, with `align: 'center'`) — not to a slide _range_ boundary, even
when `slidesPerView` is active. This matches native CSS scroll-snap's own
per-slide `scroll-snap-align`, so the drag-released rest position and a
native swipe's rest position agree.
