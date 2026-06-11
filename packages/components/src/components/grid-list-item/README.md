# GridListItem

Keyboard-navigable cell within a grid-list layout for selectable item grids.

## Usage

`GridListItem` is a compose-only leaf of [`GridList`](../grid-list/README.md).
The idiomatic API is `GridList.Item`, reached through the parent
namespace — see the [grid-list README](../grid-list/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/grid-list-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type               | Required | Default | Description                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`           | no       | —       |                                                                                                                                                                                                                                                                                                      |
| `href`     | `string`           | no       | —       |                                                                                                                                                                                                                                                                                                      |
| `rel`      | `string` \| `null` | no       | —       |                                                                                                                                                                                                                                                                                                      |
| `actions`  | `(opaque)`         | no       | —       | Action buttons. This wrapper is lifted above the stretched-link overlay via `position: relative; z-index: 1` so buttons remain clickable. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                 |
| `image`    | `(opaque)`         | no       | —       | Optional image region (avatar, thumbnail). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                |
| `meta`     | `(opaque)`         | no       | —       | Tertiary metadata (badges, supplementary text). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                           |
| `subtitle` | `(opaque)`         | no       | —       | Secondary description. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                    |
| `target`   | `(opaque)`         | no       | —       | When `target` matches `"_blank"` (case-insensitive), the component automatically composes `rel="noopener noreferrer"` with any consumer-supplied `rel` tokens to prevent reverse-tabnapping. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature. |
| `title`    | `(opaque)`         | no       | —       | Primary label. Provides the accessible name for the stretched link when `href` is set. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
