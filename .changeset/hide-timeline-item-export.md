---
'@lostgradient/cinder': minor
---

**Breaking:** Removed `TimelineItem` from the public API. The
`@lostgradient/cinder/timeline-item` import path (and its `/schema`,
`/variables`, `/styles` subpaths) and the top-level `TimelineItem` /
`TimelineItemProps` exports are gone.

`TimelineItem` is now an internal implementation detail of `Timeline` — compose
`Timeline` (which renders its items for you) instead of building a rail out of
bare `TimelineItem`s. The public timeline surface is `Timeline` and
`RunStepTimeline`, which model distinct domains (an entries-driven event rail vs.
async run/step state).
