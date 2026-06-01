# GridListItem

Keyboard-navigable cell within a grid-list layout for selectable item grids.

## Usage

`GridListItem` is a compose-only leaf of [`GridList`](../grid-list/README.md).
The idiomatic API is `GridList.Item`, reached through the parent
namespace — see the [grid-list README](../grid-list/README.md#usage) for the composed
snippet. The flat `cinder/grid-list-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type               | Required | Default | Description                                                                                                                |
| ---------- | ------------------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `href`     | `string`           | no       | —       |                                                                                                                            |
| `rel`      | `string` \| `null` | no       | —       |                                                                                                                            |
| `actions`  | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `class`    | `(opaque)`         | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `image`    | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `meta`     | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `subtitle` | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `target`   | `(opaque)`         | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `title`    | `(opaque)`         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
