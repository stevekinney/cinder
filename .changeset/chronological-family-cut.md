---
'@lostgradient/cinder': minor
---

feat(feed)!: cut the chronological family to three — delete EventTimeline, fold EventStreamViewer into Feed

BREAKING: the chronological display family is now `Timeline` (display),
`RunStepTimeline` (execution state), and `Feed` (activity and operational
streams). No compatibility aliases are shipped — cinder is pre-release.

- **`EventTimeline` is deleted, not repaired.** Four independent reviews
  concluded its layout model was wrong rather than mistuned. Its subpaths
  (`@lostgradient/cinder/event-timeline` + `/schema`, `/variables`, `/styles`,
  `/examples`) and types (`EventTimelineDate/Item/Props/Size/State`) are gone.
  Its use case — a bounded horizontal window with proportionally positioned
  events — is out of scope for the family; compose a chart or an external
  scheduling library.
- **`EventStreamViewer` is folded into `Feed`** as the new `kind="log"` arm:
  a `role="log"` viewport with follow-latest scrolling (pause on scroll-away,
  resume at bottom or via the built-in control), `loading` skeleton,
  `truncated` notice, and `connectionState` StatusDot. Migration:
  - `events` array → authored `{#each}` of `Feed.Event` children (new `tone`
    prop carries severity on the rail marker; render source/details in the
    entry body — `JsonViewer` composition replaces built-in detail panels).
  - Reconnect boundaries and sequence-gap markers → the new compose-only
    `Feed.Boundary` leaf (`role="separator"`, consumer-owned wording);
    `detectSequenceGaps` has no replacement — emit boundaries yourself.
  - `onFilter`/`filterQuery`/`onCopyVisible` → consumer-composed controls via
    the log arm's `toolbar` snippet.
  - The built-in empty state (`data-cinder-empty` + "No events to display.")
    is gone — with authored children the component cannot know the stream is
    empty; render your own `role="status"` message when your source array is
    empty.
  - `followLatest`/`loading`/`truncated`/`connectionState`/`label` carry over
    unchanged; types `EventSeverity`/`EventStreamState` are replaced by
    `FeedEventTone`/`FeedConnectionState`.
- `Feed.Event` gains `tone?: 'neutral' | 'info' | 'success' | 'warning' |
'error'` for the rail marker (non-text colour only — pair with distinct
  icons or wording).
- The Timeline "Custom dot styles" example renders real Lucide icons instead
  of literal `+` / `!` / `x` characters, and `.example.svelte` files may now
  import `lucide-svelte/icons/*`.
- `docs/decisions/chronological-display-boundaries.md` is rewritten for the
  three-component reality.
