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

| Prop             | Type                    | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ----------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`                | no       | —       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `datetime`       | `string`                | yes      | —       | ISO 8601 datetime string. Rendered as `<time datetime={datetime}>` so assistive tech and parsers receive a machine-readable timestamp. This is always the authoritative value; the visible label is separate (see `timestamp` / `timestampLabel`).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `timestamp`      | `string`                | no       | —       | Visible time label, as plain text — the common case (`"2m ago"`, `"May 12, 3:30 PM"`). Rendered inside the `<time>` element. Optional, with a deliberate three-way contract: - **omitted** (`undefined`) and no `timestampLabel` → falls back to the raw `datetime` string, which is deterministic and SSR-safe (no locale or timezone dependence). - **explicit empty string** (`timestamp=""`) → renders no visible label. This is treated as "intentionally blank", NOT as omitted, so it does **not** trigger the `datetime` fallback. Use it to hide the label while keeping the machine-readable `<time datetime>` for assistive tech. - **non-empty string** → rendered verbatim. |
| `variant`        | `"icon"` \| `"minimal"` | no       | —       | Icon variant: renders a circular badge on the rail with the icon inside.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `children`       | `(opaque)`              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `icon`           | `(opaque)`              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `timestampLabel` | `(opaque)`              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
