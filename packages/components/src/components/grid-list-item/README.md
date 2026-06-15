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

| Prop       | Type               | Required | Default | Description                                                                                                                                                                                                                                                             |
| ---------- | ------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`           | no       | —       | Additional class merged onto the `.cinder-grid-list__item` root element.                                                                                                                                                                                                |
| `href`     | `string`           | no       | —       | Destination URL. When set, the `title` snippet is rendered as a stretched `<a>` anchor covering the entire tile.                                                                                                                                                        |
| `rel`      | `string` \| `null` | no       | —       | `rel` attribute forwarded to the stretched-link anchor; `noopener noreferrer` is merged automatically when `target="_blank"`.                                                                                                                                           |
| `actions`  | `(opaque)`         | no       | —       | Action buttons. This wrapper is lifted above the stretched-link overlay via `position: relative; z-index: 1` so buttons remain clickable. Not expressible in JSON Schema; see the component types for the signature.                                                    |
| `image`    | `(opaque)`         | no       | —       | Optional image region (avatar, thumbnail). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                   |
| `meta`     | `(opaque)`         | no       | —       | Tertiary metadata (badges, supplementary text). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                              |
| `subtitle` | `(opaque)`         | no       | —       | Secondary description. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                       |
| `target`   | `(opaque)`         | no       | —       | When `target` matches `"_blank"` (case-insensitive), the component automatically composes `rel="noopener noreferrer"` with any consumer-supplied `rel` tokens to prevent reverse-tabnapping. Not expressible in JSON Schema; see the component types for the signature. |
| `title`    | `(opaque)`         | no       | —       | Primary label. Provides the accessible name for the stretched link when `href` is set. Not expressible in JSON Schema; see the component types for the signature.                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
