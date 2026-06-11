# ChoiceGridItem

Selectable answer tile used inside a ChoiceGrid; carries selected, disabled, correct, incorrect, and pending states without shifting cell dimensions.

## Usage

`ChoiceGridItem` is a compose-only leaf of [`ChoiceGrid`](../choice-grid/README.md).
The idiomatic API is `ChoiceGrid.Item`, reached through the parent
namespace — see the [ChoiceGrid README](../choice-grid/README.md#usage) for the
composed snippet. The flat `@lostgradient/cinder/choice-grid-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop       | Type                                                       | Required | Default | Description                                                                                                                                        |
| ---------- | ---------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                                   | no       | —       | Additional class names merged with `.cinder-choice-grid-item`.                                                                                     |
| `disabled` | `boolean`                                                  | no       | —       | When true this item cannot be selected or focused.                                                                                                 |
| `state`    | `"neutral"` \| `"correct"` \| `"incorrect"` \| `"pending"` | no       | —       | Feedback state for assessment / quiz usage. Defaults to `'neutral'`. Layout dimensions do NOT change across states (stable cell sizing guarantee). |
| `value`    | `string`                                                   | yes      | —       | The value this item represents. Used as the key for selection state, roving tabindex registration, and ARIA attributes.                            |
| `children` | `(opaque)`                                                 | yes      | —       | Item content — label text, an icon, or richer markup. Not expressible in JSON Schema; see the component types for the signature.                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
