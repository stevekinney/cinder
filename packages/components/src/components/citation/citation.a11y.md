# Citation design and accessibility review

Complete this record before merge. Automated checks can detect malformed APIs,
missing semantics, and structural regressions. They cannot decide that a
component is drab, bulbous, ugly, has a poor layout, or whether the interaction
model is wrong. Those judgments require human review.

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Approved for implementation review.
- Nearest neighbours: HoverCard, Pagination.
- Why this component exists: It combines an inline source marker with paginated source disclosure.
- Findings and resolutions: Marker is a keyboard-focusable button and source links remain native links.

## Novel interaction accessibility review

A novel interaction model includes a new disclosure or keyboard pattern,
entering or leaving the top layer, or making previously static content
interactive.

- Applies: Yes—HoverCard disclosure owns focus and Escape dismissal.
- Reviewer: _Pending when this review applies._
- Review outcome: _Pending when this review applies._

### Focus management

_Record initial focus, focus movement, dismissal, restoration, and behavior
when the trigger or focused target disappears._

### Keyboard matrix

| Key or gesture | Context | Expected behavior |
| -------------- | ------- | ----------------- |
| _Pending_      |         |                   |

### Assistive-technology announcements

_Record the accessible name, role, state, live-region announcements, and the
screen-reader/browser combinations reviewed._
