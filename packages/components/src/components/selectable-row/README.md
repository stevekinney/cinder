# SelectableRow

Full-width row with a native button or link primary action and independent trailing controls.

Use `SelectableRow` when activating the main row body opens or selects an item while Rename,
menu, or external-link controls need their own Tab stops. The primary action contains the leading,
title, description, and metadata regions; `trailingActions` renders beside it rather than inside it,
so the resulting HTML never nests interactive elements.

Choose `ActionRow` when the entire row is one button and its trailing content is non-interactive.
Choose `StackedListItem` when the row is static and only its title needs to link.

## Props

<!-- generated:props:start -->

| Prop              | Type                                                                     | Required | Default         | Description                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------ | -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`                                                                 | no       | —               | Additional classes merged with `.cinder-selectable-row`.                                                                                                              |
| `currentValue`    | `"page"` \| `"step"` \| `"location"` \| `"date"` \| `"time"` \| `"true"` | no       | `"page"`        | `aria-current` value emitted when a linked row is selected.                                                                                                           |
| `density`         | `"comfortable"` \| `"condensed"`                                         | no       | `"comfortable"` | Density token surfaced as `data-cinder-density`.                                                                                                                      |
| `href`            | `string`                                                                 | no       | —               | Destination that renders the primary action as a native anchor.                                                                                                       |
| `rel`             | `string` \| `null`                                                       | no       | —               | `rel` forwarded to the primary anchor; `noopener noreferrer` is merged automatically when `target="_blank"`.                                                          |
| `selected`        | `boolean`                                                                | no       | `false`         | Whether the primary action represents the selected or current row.                                                                                                    |
| `style`           | `string`                                                                 | no       | —               | Inline style string applied to the `.cinder-selectable-row` root.                                                                                                     |
| `type`            | `"button"` \| `"submit"` \| `"reset"`                                    | no       | `"button"`      | Native button type.                                                                                                                                                   |
| `description`     | `(opaque)`                                                               | no       | —               | Secondary description below the title. Not expressible in JSON Schema; see the component types for the signature.                                                     |
| `leading`         | `(opaque)`                                                               | no       | —               | Leading visual such as an icon, avatar, marker, or status dot. Not expressible in JSON Schema; see the component types for the signature.                             |
| `meta`            | `(opaque)`                                                               | no       | —               | Tertiary metadata such as a timestamp, status, or compact badge. Not expressible in JSON Schema; see the component types for the signature.                           |
| `onclick`         | `(opaque)`                                                               | no       | —               | Called when the native primary button activates. Not expressible in JSON Schema; see the component types for the signature.                                           |
| `target`          | `(opaque)`                                                               | no       | —               | Browsing context for the primary anchor. `_blank` merges `noopener noreferrer` into `rel`. Not expressible in JSON Schema; see the component types for the signature. |
| `title`           | `(opaque)`                                                               | yes      | —               | Primary row label. Required. Not expressible in JSON Schema; see the component types for the signature.                                                               |
| `trailingActions` | `(opaque)`                                                               | no       | —               | Independent controls rendered as siblings after the primary action. Not expressible in JSON Schema; see the component types for the signature.                        |

<!-- generated:props:end -->

## CSS Variables

Override these variables on the `SelectableRow` root with the `style` prop or a stylesheet rule
targeting a custom class.

<!-- generated:variables:start -->

- `--cinder-selectable-row-column-gap`
- `--cinder-selectable-row-content-gap`
- `--cinder-selectable-row-leading-gap`
- `--cinder-selectable-row-padding-block`
- `--cinder-selectable-row-padding-inline`
- `--cinder-selectable-row-trailing-actions-gap`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
