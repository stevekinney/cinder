# EventTimeline · accessibility

## Pattern

EventTimeline presents scheduled events along a bounded horizontal time axis.

Purpose: Proportional schedule strip with fired and upcoming event states, a visual now marker, and collision-nudged labels.

## Use when

- Showing several events across a known start/end range, such as a next-24-hour schedule.
- Comparing fired, failed, and upcoming states in a compact timeline strip.

## Avoid when

- Presenting a vertical activity history or audit log — use timeline.
- Showing step-by-step run execution — use run-step-timeline.

## Keyboard and focus

EventTimeline is non-interactive and does not enter the tab order by default. Do not make timeline dots clickable unless the composition uses native controls or links with visible focus indicators and clear accessible names.

## Names, roles, and state

EventTimeline renders a named `role="list"` and one `role="listitem"` per valid event. Event labels are rendered with `time` elements; the visual now marker is hidden from assistive technologies because it is decorative unless the surrounding content explains current time.

State color is supplemental. Keep labels and sublabels descriptive enough that users do not need color to understand the event.

## Verification

- Render EventTimeline in the playground or a focused test fixture.
- Inspect the list name, item count, labels, and timestamps in browser accessibility tools.
- Check forced-colors mode for dot state contrast and now-marker visibility.

Related components: `timeline`, `run-step-timeline`, `status-dot`.
