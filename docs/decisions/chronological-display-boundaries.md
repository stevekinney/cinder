# Chronological display boundaries

This decision preserves the five public chronological display components. They
share ordered time-related content, but they own different questions: what is
being ordered, how much interaction the display owns, and whether new entries
are expected while the user is reading.

## Decision

| Component                                                                                     | Choose it for                                                                                                                                                 | Avoid it for                                                                     | Nearest alternatives                                                                                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`Timeline`](../../packages/components/src/components/timeline/README.md)                     | A timestamp-first sequence of workflow, audit, or run-history events where grouping, marker tones, and connector continuity are useful.                       | Live activity, operational diagnostics, or step state with retries and branches. | `Feed` for activity streams; `RunStepTimeline` for execution state; `EventTimeline` for a horizontal schedule. |
| [`RunStepTimeline`](../../packages/components/src/components/run-step-timeline/README.md)     | The state of an asynchronous execution: pending/running/terminal statuses, durations, retries, progress, branches, compensation, and inline details.          | A flat timestamp log, a bounded schedule, or an interactive wizard.              | `Timeline` for timestamp-first history; `Steps` for user-driven procedures.                                    |
| [`EventTimeline`](../../packages/components/src/components/event-timeline/README.md)          | A bounded horizontal time window with proportionally positioned scheduled, fired, or upcoming events.                                                         | Sequential process history, dense activity, or execution state.                  | `Timeline` for an ordered event rail; `RunStepTimeline` for step state.                                        |
| [`Feed`](../../packages/components/src/components/feed/README.md)                             | A user-facing chronological activity or notification list, optionally announced as entries arrive through its live-region contract.                           | Dense operational logs, structured diagnostics, or a static event rail.          | `EventStreamViewer` for operational streams; `Timeline` for static temporal history.                           |
| [`EventStreamViewer`](../../packages/components/src/components/event-stream-viewer/README.md) | A dense operational append-only stream with follow-latest scrolling, filtering, copy, severity, JSON details, reconnect boundaries, and sequence-gap markers. | Social activity, notification feeds, or a simple historical timeline.            | `Feed` for user-facing activity; `Timeline` for a simpler static history.                                      |

## Non-overlapping contracts

- **Temporal history versus execution state:** `Timeline` describes events;
  `RunStepTimeline` describes the state machine of work being executed.
- **Sequential history versus proportional schedule:** `Timeline` owns a
  readable event rail in either orientation; `EventTimeline` owns proportional
  placement inside a bounded time range.
- **Activity versus diagnostics:** `Feed` is the user-facing activity stream
  whose wrapper can opt into polite announcements through its `live` prop.
  `EventStreamViewer` is the operator-facing diagnostic console: its
  `role="log"` viewport has implicit live-region semantics and pairs those with
  stream controls and structured event inspection.
- **Static versus mutating content:** A chronological list is not implicitly a
  live region. Choose `Feed` only when its `live` contract is appropriate, and
  choose `EventStreamViewer` when an operational log region, follow-latest, and
  stream state are part of the experience.

This is a preserve decision. It changes no public API, rendering behavior, CSS,
or exports. Future additions to one family must satisfy the domain and
avoid-when boundary above before introducing overlapping props or behavior.
