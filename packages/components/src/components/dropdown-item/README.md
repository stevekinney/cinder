# DropdownItem

Selectable item within a dropdown menu, supporting icons, labels, and keyboard navigation.

## Usage

`DropdownItem` is a compose-only leaf of [`Dropdown`](../dropdown/README.md).
The idiomatic API is `Dropdown.Item`, reached through the parent
namespace — see the [dropdown README](../dropdown/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/dropdown-item` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop            | Type                                  | Required | Default | Description                                                                                                                |
| --------------- | ------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`                              | no       | —       |                                                                                                                            |
| `closeOnSelect` | `boolean`                             | no       | —       |                                                                                                                            |
| `disabled`      | `boolean`                             | no       | —       | When true the item is inert: click is blocked and aria-disabled is set.                                                    |
| `href`          | `string`                              | no       | —       |                                                                                                                            |
| `inset`         | `boolean`                             | no       | —       |                                                                                                                            |
| `type`          | `"button"` \| `"submit"` \| `"reset"` | no       | —       | Button type forwarded to the `<button>` element. Defaults to `"button"`.                                                   |
| `variant`       | `"default"` \| `"danger"`             | no       | —       |                                                                                                                            |
| `children`      | `(opaque)`                            | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
