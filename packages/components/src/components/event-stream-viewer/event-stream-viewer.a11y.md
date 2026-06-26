# EventStreamViewer — Accessibility Notes

## Pattern

Log / live region pattern. The scrollable event list uses `role="log"` (an implicit ARIA live region with polite politeness) so screen readers announce new events without interrupting the current reading context. Toolbar controls follow the standard button and input patterns. Reconnect and sequence-gap markers are rendered in document order so assistive technology reaches the same stream continuity context as sighted users.

## Roles names states

| Element                   | Role        | Name source                                          | States / Properties                                              |
| ------------------------- | ----------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Root `<div>`              | (none)      | —                                                    | `data-cinder-loading`, `data-cinder-empty`, `data-cinder-paused` |
| Toolbar `<div>`           | `group`     | `aria-label="Stream controls"`                       | —                                                                |
| Scroll viewport `<div>`   | `log`       | `aria-label` from the `label` prop                   | Implicit polite live region, `tabindex="0"`                      |
| Event list `<ol>`         | (list)      | `aria-label` from the `label` prop                   | —                                                                |
| Event item `<li>`         | (listitem)  | —                                                    | `data-cinder-severity`                                           |
| Reconnect marker `<div>`  | `separator` | `aria-label="Reconnected — N events replayed"`       | —                                                                |
| Sequence gap `<div>`      | `note`      | `aria-label="Sequence gap — expected X, received Y"` | —                                                                |
| Timestamp `<time>`        | (none)      | —                                                    | `datetime` (ISO 8601)                                            |
| Severity badge `<span>`   | (none)      | `aria-label="Severity: {severity}"`                  | —                                                                |
| Details toggle `<button>` | button      | `aria-expanded`, `aria-controls`                     | —                                                                |
| Copy-event `<button>`     | button      | `aria-label="Copy event: {summary}"`                 | —                                                                |
| Copy-visible `<button>`   | button      | `aria-label="Copy all visible events"`               | `disabled` when events is empty                                  |
| Filter `<input>`          | (search)    | `aria-label="Filter events"`                         | —                                                                |
| Copy announcement         | `status`    | —                                                    | `aria-live="polite"`, `aria-atomic="true"`                       |
| Empty state `<div>`       | `status`    | —                                                    | —                                                                |
| Truncation notice `<div>` | `status`    | —                                                    | `aria-live="polite"`                                             |
| Loading region `<div>`    | (none)      | `aria-label="Loading events"`                        | —                                                                |
| Skeleton divs `<div>`     | —           | —                                                    | `aria-hidden="true"`                                             |

## Keyboard

| Key                      | Action                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab                      | Move focus into and through toolbar controls (resume button, filter input, copy-visible button), then to the scroll viewport, then to per-event copy buttons and details toggles |
| Enter / Space            | Activate focused button (resume-following, copy, details-toggle)                                                                                                                 |
| Arrow Up / Arrow Down    | Scroll the viewport when the log region has focus                                                                                                                                |
| Arrow Left / Arrow Right | Scroll the viewport horizontally when the log region has focus                                                                                                                   |

## Mouse / pointer

Hovering over an event row reveals the per-event Copy button (shown via CSS opacity transition). Clicking Copy writes the formatted event text to the clipboard. Clicking a details toggle expands or collapses the JsonViewer panel for that event. Clicking "Resume following" re-enables auto-scroll to the bottom. Clicking "Copy visible" calls the `oncopyvisible` callback with all visible event, reconnect, and sequence-gap text.

## Hard scope caps

- **No virtualization.** The component renders all `events` in the DOM. Consumers needing large backlogs (thousands of entries) must trim the array themselves and use the `truncated` prop to surface the truncation notice. The `truncated` prop does not slice the array — that is the consumer's responsibility.
- **No keyboard navigation between event entries.** Events are list items; AT users navigate with the standard list reading commands of their screen reader. The viewer does not implement arrow-key roving focus between individual events.
- **No drag reordering.** Events are always rendered in the source order the consumer provides (`events[0]` is the oldest, `events[n-1]` is the newest).
- **Live region is opt-out only.** The viewport renders with `role="log"` and relies on that role's implicit polite live-region semantics. Consumers who need a static non-announcing view should provide a pre-filtered or pre-snapshotted `events` array rather than suppressing the live region.
- **Sequence gaps are advisory.** The component only inserts a gap marker when `detectSequenceGaps` is true, the current `filterQuery` is blank, and two consecutive rendered `StreamEvent` entries both provide integer `sequence` values where the later sequence is not the previous sequence plus one. It does not validate server ordering, backfill missing events, or infer gaps across filtered, retained, or unnumbered events.
