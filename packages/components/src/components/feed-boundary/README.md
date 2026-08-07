# FeedBoundary

Separator entry inside a feed marking a stream discontinuity such as a reconnect or a sequence gap.

## Usage

`FeedBoundary` is a compose-only leaf of [`Feed`](../feed/README.md).
The idiomatic API is `Feed.Boundary`, reached through the parent
namespace — see the [feed README](../feed/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/feed-boundary` subpath remains exported
for à-la-carte builds that import the leaf directly.

The consumer owns the wording (`label`); the boundary owns the
`role="separator"` semantics and the horizontal-rule treatment.

## Props

<!-- generated:props:start -->

| Prop        | Type     | Required | Default | Description                                                                                                                                                                                                                                   |
| ----------- | -------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`     | `string` | no       | —       | Additional class merged onto the `.cinder-feed-boundary` root element.                                                                                                                                                                        |
| `datetime`  | `string` | no       | —       | Optional machine-readable ISO 8601 datetime for the boundary moment. Rendered as `<time datetime>` when provided.                                                                                                                             |
| `label`     | `string` | yes      | —       | Accessible and visible label for the boundary, e.g. "Reconnected — 3 events replayed" or "Sequence gap — expected 12, received 15". The consumer owns the wording; the boundary owns the `role="separator"` semantics and the rule treatment. |
| `timestamp` | `string` | no       | —       | Optional human-readable timestamp label. Falls back to `datetime` when omitted while `datetime` is set.                                                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
