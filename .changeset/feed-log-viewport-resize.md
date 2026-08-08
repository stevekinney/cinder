---
'@lostgradient/cinder': patch
---

fix(feed): re-pin the log arm when the viewport resizes

`Feed` with `kind="log"` only observed the entry list, so a viewport that
shrank without a content change — a parent layout shortening, a consumer
tightening `max-block-size` — left the reading position stale: the latest
entries fell below the fold while `following` stayed `true` and the resume
control stayed hidden. The follow effect now observes the viewport as well
as the list and re-scrolls to the latest entry on either resize.
