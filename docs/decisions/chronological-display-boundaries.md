# Chronological display boundaries

**Status:** Accepted 2026-08-05 (supersedes the 2026-07 preserve decision).

The chronological display family is **three** public components: `Timeline`,
`RunStepTimeline`, and `Feed`. They share ordered time-related content, but
they own different questions: what is being ordered, how much interaction the
display owns, and whether new entries are expected while the user is reading.

Two former members were removed in the 2026-08 consolidation:

- **`EventTimeline` was deleted, not repaired.** Four independent reviews
  concluded its layout model was wrong rather than mistuned — the lane index
  was a collision artifact that read as data, and labels were displaced even
  when nothing collided. Its use case (a bounded horizontal window with
  proportionally positioned events) is explicitly out of scope for this
  family; the nearest recipe is composing a chart component or an external
  scheduling library.
- **`EventStreamViewer` was folded into `Feed`** as the `kind="log"` arm. The
  built-in operator chrome (filter input, copy actions, JSON detail
  inspection, automatic sequence-gap detection) became consumer composition:
  pass controls via the log arm's `toolbar` snippet, render details inside
  `Feed.Event` children, and emit `Feed.Boundary` entries for reconnects and
  gaps.

## Decision

| Component                                                                                 | Choose it for                                                                                                                                                                  | Avoid it for                                                                                | Nearest alternatives                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`Timeline`](../../packages/components/src/components/timeline/README.md)                 | A timestamp-first sequence of workflow, audit, or run-history events where grouping, marker tones, and connector continuity are useful.                                        | Live activity, operational diagnostics, or step state with retries and branches.            | `Feed` for activity and operational streams; `RunStepTimeline` for execution state.                                      |
| [`RunStepTimeline`](../../packages/components/src/components/run-step-timeline/README.md) | The state of an asynchronous execution: pending/running/terminal statuses, durations, retries, progress, branches, compensation, and inline details.                           | A flat timestamp log, an interactive wizard, or a dense operational log.                    | `Timeline` for timestamp-first history; `Steps` for user-driven procedures; `Feed`'s log arm for dense operational logs. |
| [`Feed`](../../packages/components/src/components/feed/README.md)                         | A chronological stream of entries — the `list` arm for user-facing activity/notifications, the `log` arm for operator-facing append-only streams with follow-latest scrolling. | A static event rail (use `Timeline`) or structured execution state (use `RunStepTimeline`). | `Timeline` for static temporal history; `RunStepTimeline` for step state.                                                |

`Steps` is deliberately **not** in this family: it is interactive wizard
navigation (`@category navigation`), named here only as the out-of-family
alternative when the "timeline" someone asks for is really a user-driven
procedure.

## Non-overlapping contracts

- **Temporal history versus execution state:** `Timeline` describes events;
  `RunStepTimeline` describes the state machine of work being executed.
- **Static versus mutating content, in one component:** a chronological list
  is not implicitly a live region. `Feed`'s `list` arm opts into polite
  announcements through its `live` prop; its `log` arm renders a
  `role="log"` viewport (implicit live-region semantics) and pairs it with
  follow-latest scrolling, loading/truncation states, and connection status.
  Choose the arm by audience: user-facing activity reads as a list, operator
  diagnostics read as a log.
- **Behavior lives in the component; chrome lives in composition:** the log
  arm owns scrolling, semantics, and stream state. Filtering, copy actions,
  and structured detail inspection are consumer compositions via the
  `toolbar` snippet and entry children.

Future additions to one family must satisfy the domain and avoid-when boundary
above before introducing overlapping props or behavior.
