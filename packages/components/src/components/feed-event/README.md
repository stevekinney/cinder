# FeedEvent

Individual timestamped entry within a chronological activity feed.

## Usage

`FeedEvent` is a compose-only leaf of [`Feed`](../feed/README.md).
The idiomatic API is `Feed.Event`, reached through the parent
namespace — see the [feed README](../feed/README.md#usage) for the composed
snippet. The flat `cinder/feed-event` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop        | Type                    | Required | Default | Description                                                                                                                                                                                                                                       |
| ----------- | ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`     | `string`                | no       | —       |                                                                                                                                                                                                                                                   |
| `datetime`  | `string`                | yes      | —       | ISO 8601 datetime string. Rendered as `<time datetime={datetime}>` so assistive tech and parsers receive a machine-readable timestamp. The visible label inside the `<time>` element is consumer-controlled via the required `timestamp` snippet. |
| `variant`   | `"icon"` \| `"minimal"` | no       | —       | Icon variant: renders a circular badge on the rail with the icon inside.                                                                                                                                                                          |
| `content`   | `(opaque)`              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                        |
| `icon`      | `(opaque)`              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                        |
| `timestamp` | `(opaque)`              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                        |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
