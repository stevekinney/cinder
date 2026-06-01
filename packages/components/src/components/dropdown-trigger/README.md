# DropdownTrigger

Activates the associated dropdown menu on click or keyboard interaction.

## Usage

`DropdownTrigger` is a compose-only leaf of [`Dropdown`](../dropdown/README.md).
The idiomatic API is `Dropdown.Trigger`, reached through the parent
namespace — see the [dropdown README](../dropdown/README.md#usage) for the composed
snippet. The flat `cinder/dropdown-trigger` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop        | Type       | Required | Default | Description                                                                                                                |
| ----------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`     | `string`   | no       | —       |                                                                                                                            |
| `showCaret` | `boolean`  | no       | —       | Render the trailing disclosure caret. Defaults to true.                                                                    |
| `children`  | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
