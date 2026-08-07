# FeedBoundary — Accessibility Notes

## Why this component exists

`FeedBoundary` was introduced when `EventStreamViewer` was folded into `Feed`
(see `docs/decisions/chronological-display-boundaries.md`). The retired
component synthesized reconnect and sequence-gap markers from its data props;
with authored children, the marker becomes a compose-only leaf. Its admission
case is semantics, not layout: it owns the `role="separator"` contract for a
non-event entry inside a feed list.

Nearest neighbours: `feed-event` (a dated entry — a boundary is deliberately
not an event and carries no rail marker), and `divider` (a generic visual
rule with no list-item semantics; a boundary is an `<li>` so the feed list's
item count stays honest for assistive technology).

## Role and ARIA attributes

- The root is an `<li>` so it participates in the parent `<ol>`'s list
  semantics — screen readers announce a consistent item count.
- The inner content div carries `role="separator"` with `aria-label` set to
  the consumer-supplied `label`. Separators are static (not focusable); this
  matches the retired EventStreamViewer's marker semantics.
- The label is both visible and the accessible name, so sighted and
  screen-reader users get the same wording.

## Timestamps

When `datetime` is provided, the time label renders as `<time datetime>` so
assistive tech and parsers receive a machine-readable timestamp; the visible
label falls back from `timestamp` to the raw `datetime` string (deterministic
and SSR-safe — no locale dependence).

## Colour and contrast

The flanking rules use `--cinder-border-muted` and are decorative; the label
text uses `--cinder-text-muted` at `--cinder-text-xs`, the same treatment as
feed-event time labels. State is conveyed by the label text, never by colour
alone.

## Review record

- Design review: covered by the 2026-08-05 chronological-family consolidation
  decision (decision 4) — the boundary replaces EventStreamViewer's built-in
  reconnect/sequence-gap markers with a consumer-authored leaf.
- Interaction model: none (static separator); no novel-interaction
  accessibility review required.
