# RelativeTime design and accessibility review

Complete this record before merge. Automated checks can detect malformed APIs,
missing semantics, and structural regressions. They cannot decide that a
component is drab, bulbous, ugly, has a poor layout, or whether the interaction
model is wrong. Those judgments require human review.

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Final review complete—approved.
- Nearest neighbours: TimeField, Tooltip.
- Why this component exists: It owns Intl.RelativeTimeFormat semantics and live ticking.
- Findings and resolutions: Uses a native time element, renders `Invalid date` safely for invalid inputs, and has no interactive behavior.

## Novel interaction accessibility review

A novel interaction model includes a new disclosure or keyboard pattern,
entering or leaving the top layer, or making previously static content
interactive.

- Applies: No—this is a non-interactive timestamp.
- Reviewer: Not applicable.
- Review outcome: No novel interaction review required.

### Focus management

Not applicable; the component is not focusable or interactive.

### Keyboard matrix

| Key or gesture | Context          | Expected behavior        |
| -------------- | ---------------- | ------------------------ |
| None           | Static timestamp | No keyboard interaction. |

### Assistive-technology announcements

The native `time` element exposes the machine-readable timestamp through `datetime`; its localized text is the accessible content and does not use a live region.
