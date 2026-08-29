# CodeLocation design and accessibility review

Complete this record before merge. Automated checks can detect malformed APIs,
missing semantics, and structural regressions. They cannot decide that a
component is drab, bulbous, ugly, has a poor layout, or whether the interaction
model is wrong. Those judgments require human review.

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Final review complete—approved.
- Nearest neighbours: Chip, CodeBlock.
- Why this component exists: It standardizes accessible file-coordinate formatting.
- Findings and resolutions: Uses a code element inside a non-interactive chip and renders only file coordinates with an explicit line before any column.

## Novel interaction accessibility review

A novel interaction model includes a new disclosure or keyboard pattern,
entering or leaving the top layer, or making previously static content
interactive.

- Applies: No—this is a non-interactive chip.
- Reviewer: Not applicable.
- Review outcome: No novel interaction review required.

### Focus management

Not applicable; the component is not focusable or interactive.

### Keyboard matrix

| Key or gesture | Context                | Expected behavior        |
| -------------- | ---------------------- | ------------------------ |
| None           | Static source location | No keyboard interaction. |

### Assistive-technology announcements

The file, line, and column are exposed as ordinary text inside a semantic `code` element.
